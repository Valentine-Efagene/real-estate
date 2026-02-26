import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    ConflictError,
    ValidationError,
    OrganizationStatus,
} from '@valentine-efagene/qshelter-common';
import { onboardingService } from './onboarding.service';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateOrganizationInput {
    name: string;
    /** Organization type codes (e.g., ['PLATFORM', 'DEVELOPER']) */
    typeCodes: string[];
    /** Which type is primary for display purposes */
    primaryTypeCode?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    website?: string;
    description?: string;
    // Bank-specific
    bankCode?: string;
    bankLicenseNo?: string;
    swiftCode?: string;
    sortCode?: string;
    // Developer-specific
    cacNumber?: string;
    taxId?: string;
}

export interface UpdateOrganizationInput {
    name?: string;
    /** Replace organization type codes (e.g., ['PLATFORM', 'DEVELOPER']) */
    typeCodes?: string[];
    /** Which type is primary for display purposes */
    primaryTypeCode?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    website?: string;
    description?: string;
    status?: OrganizationStatus;
    // Bank-specific
    bankCode?: string;
    bankLicenseNo?: string;
    swiftCode?: string;
    sortCode?: string;
    // Developer-specific
    cacNumber?: string;
    taxId?: string;
}

export interface AddMemberInput {
    userId: string;
    roleId?: string;
    additionalRoleIds?: string[];
    title?: string;
    department?: string;
    employeeId?: string;
}

export interface UpdateMemberInput {
    roleId?: string;
    additionalRoleIds?: string[];
    title?: string;
    department?: string;
    employeeId?: string;
    isActive?: boolean;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    typeCode?: string; // Filter by organization type code
    status?: OrganizationStatus;
    search?: string;
}

// =============================================================================
// ORGANIZATION SERVICE
// =============================================================================

class OrganizationService {
    /**
     * Create a new organization within a tenant.
     */
    async create(tenantId: string, data: CreateOrganizationInput) {
        // Validate type codes exist
        if (!data.typeCodes || data.typeCodes.length === 0) {
            throw new ValidationError('At least one organization type code is required');
        }

        // Resolve type codes to IDs
        const orgTypes = await prisma.organizationType.findMany({
            where: {
                tenantId,
                code: { in: data.typeCodes },
            },
        });

        const missingCodes = data.typeCodes.filter(
            (code) => !orgTypes.some((t) => t.code === code)
        );
        if (missingCodes.length > 0) {
            throw new ValidationError(`Unknown organization type codes: ${missingCodes.join(', ')}`);
        }

        // Determine primary type
        const primaryCode = data.primaryTypeCode || data.typeCodes[0];
        const primaryType = orgTypes.find((t) => t.code === primaryCode);
        if (!primaryType) {
            throw new ValidationError(`Primary type code ${primaryCode} not found in type codes`);
        }

        // Normalize empty strings to undefined (so they become null in DB)
        // This prevents unique constraint issues with empty strings
        const normalizedData = {
            name: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            country: data.country,
            website: data.website,
            description: data.description,
            bankCode: data.bankCode?.trim() || undefined,
            bankLicenseNo: data.bankLicenseNo?.trim() || undefined,
            swiftCode: data.swiftCode?.trim() || undefined,
            sortCode: data.sortCode?.trim() || undefined,
            cacNumber: data.cacNumber?.trim() || undefined,
            taxId: data.taxId?.trim() || undefined,
        };

        // Check for duplicate bank code or CAC number within tenant
        if (normalizedData.bankCode) {
            const existing = await prisma.organization.findUnique({
                where: { tenantId_bankCode: { tenantId, bankCode: normalizedData.bankCode } },
            });
            if (existing) {
                throw new ConflictError(`Organization with bank code ${normalizedData.bankCode} already exists`);
            }
        }

        if (normalizedData.cacNumber) {
            const existing = await prisma.organization.findUnique({
                where: { tenantId_cacNumber: { tenantId, cacNumber: normalizedData.cacNumber } },
            });
            if (existing) {
                throw new ConflictError(`Organization with CAC number ${normalizedData.cacNumber} already exists`);
            }
        }

        // Create organization with type assignments in a transaction
        const orgResult = await prisma.$transaction(async (tx) => {
            // Check if any org type requires onboarding
            const typesWithOnboarding = orgTypes.filter((t) => t.onboardingFlowId);
            const requiresOnboarding = typesWithOnboarding.length > 0;

            const org = await tx.organization.create({
                data: {
                    tenantId,
                    ...normalizedData,
                    // If any type requires onboarding, start as PENDING; otherwise ACTIVE
                    status: requiresOnboarding ? 'PENDING' : 'ACTIVE',
                },
            });

            // Create type assignments
            await tx.organizationTypeAssignment.createMany({
                data: orgTypes.map((type) => ({
                    organizationId: org.id,
                    typeId: type.id,
                    isPrimary: type.id === primaryType.id,
                })),
            });

            // Return with relations
            const result = await tx.organization.findUnique({
                where: { id: org.id },
                include: {
                    types: {
                        include: {
                            orgType: { select: { id: true, code: true, name: true } },
                        },
                    },
                    members: {
                        include: {
                            user: {
                                select: { id: true, email: true, firstName: true, lastName: true },
                            },
                        },
                    },
                },
            });

            return {
                org: result,
                requiresOnboarding,
                typesWithOnboarding,
            };
        });

        // Create onboarding AFTER transaction commits (so org exists in DB)
        if (orgResult.requiresOnboarding && orgResult.org) {
            const onboardingType = orgResult.typesWithOnboarding.find((t) => t.id === primaryType.id)
                || orgResult.typesWithOnboarding[0];
            try {
                await onboardingService.createOnboarding(
                    tenantId,
                    orgResult.org.id,
                    onboardingType.onboardingFlowId!,
                );
                console.log(`[OrganizationService] Created onboarding for org ${orgResult.org.name} (type: ${onboardingType.code})`);
            } catch (error) {
                console.error('[OrganizationService] Failed to create onboarding:', error);
                // Don't fail org creation — onboarding can be created manually
            }
        }

        return orgResult.org;
    }

    /**
     * Get organization by ID.
     */
    async findById(tenantId: string, id: string) {
        const org = await prisma.organization.findFirst({
            where: { id, tenantId },
            include: {
                types: {
                    include: {
                        orgType: { select: { id: true, code: true, name: true } },
                    },
                },
                members: {
                    include: {
                        user: {
                            select: { id: true, email: true, firstName: true, lastName: true },
                        },
                    },
                },
            },
        });

        if (!org) {
            throw new NotFoundError('Organization not found');
        }

        return org;
    }

    /**
     * List organizations with pagination and filtering.
     */
    async findAll(tenantId: string, params: PaginationParams = {}) {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            typeCode,
            status,
            search,
        } = params;

        const where: any = { tenantId };
        // Filter by organization type code via the types relation
        if (typeCode) {
            where.types = {
                some: {
                    type: { code: typeCode },
                },
            };
        }
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.organization.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    types: {
                        include: {
                            orgType: { select: { id: true, code: true, name: true } },
                        },
                    },
                    _count: { select: { members: true } },
                },
            }),
            prisma.organization.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Update organization.
     */
    async update(tenantId: string, id: string, data: UpdateOrganizationInput) {
        const org = await this.findById(tenantId, id);

        // Check for duplicate bank code or CAC number if updating
        if (data.bankCode && data.bankCode !== org.bankCode) {
            const existing = await prisma.organization.findUnique({
                where: { tenantId_bankCode: { tenantId, bankCode: data.bankCode } },
            });
            if (existing) {
                throw new ConflictError(`Organization with bank code ${data.bankCode} already exists`);
            }
        }

        if (data.cacNumber && data.cacNumber !== org.cacNumber) {
            const existing = await prisma.organization.findUnique({
                where: { tenantId_cacNumber: { tenantId, cacNumber: data.cacNumber } },
            });
            if (existing) {
                throw new ConflictError(`Organization with CAC number ${data.cacNumber} already exists`);
            }
        }

        // Separate typeCodes/primaryTypeCode from scalar fields
        const { typeCodes, primaryTypeCode, ...scalarData } = data;

        // If typeCodes provided, replace all type assignments in a transaction
        if (typeCodes && typeCodes.length > 0) {
            // Resolve type codes to IDs
            const orgTypes = await prisma.organizationType.findMany({
                where: { tenantId, code: { in: typeCodes } },
            });

            const missingCodes = typeCodes.filter(
                (code) => !orgTypes.some((t) => t.code === code)
            );
            if (missingCodes.length > 0) {
                throw new ValidationError(`Unknown organization type codes: ${missingCodes.join(', ')}`);
            }

            const primaryCode = primaryTypeCode || typeCodes[0];
            const primaryType = orgTypes.find((t) => t.code === primaryCode);
            if (!primaryType) {
                throw new ValidationError(`Primary type code ${primaryCode} not found in type codes`);
            }

            return prisma.$transaction(async (tx) => {
                // Update scalar fields
                await tx.organization.update({
                    where: { id },
                    data: scalarData,
                });

                // Delete existing type assignments
                await tx.organizationTypeAssignment.deleteMany({
                    where: { organizationId: id },
                });

                // Create new type assignments
                await tx.organizationTypeAssignment.createMany({
                    data: orgTypes.map((type) => ({
                        organizationId: id,
                        typeId: type.id,
                        isPrimary: type.id === primaryType.id,
                    })),
                });

                return tx.organization.findUnique({
                    where: { id },
                    include: {
                        types: {
                            include: {
                                orgType: { select: { id: true, code: true, name: true } },
                            },
                        },
                        members: {
                            include: {
                                user: {
                                    select: { id: true, email: true, firstName: true, lastName: true },
                                },
                            },
                        },
                    },
                });
            });
        }

        // No type changes — just update scalar fields
        return prisma.organization.update({
            where: { id },
            data: scalarData,
            include: {
                types: {
                    include: {
                        orgType: { select: { id: true, code: true, name: true } },
                    },
                },
                members: {
                    include: {
                        user: {
                            select: { id: true, email: true, firstName: true, lastName: true },
                        },
                    },
                },
            },
        });
    }

    /**
     * Delete organization (soft delete by setting status to INACTIVE).
     */
    async delete(tenantId: string, id: string) {
        await this.findById(tenantId, id);

        return prisma.organization.update({
            where: { id },
            data: { status: 'INACTIVE' },
        });
    }

    // =========================================================================
    // MEMBER MANAGEMENT
    // =========================================================================

    /**
     * Add a member to an organization.
     * Also assigns the appropriate role based on organization type.
     */
    async addMember(tenantId: string, organizationId: string, data: AddMemberInput) {
        await this.findById(tenantId, organizationId);

        // Verify user exists and has a TenantMembership for this tenant
        // Note: Users don't have tenantId directly set on User model - they have TenantMemberships
        const user = await prisma.user.findFirst({
            where: {
                id: data.userId,
                tenantMemberships: {
                    some: { tenantId },
                },
            },
        });
        if (!user) {
            throw new NotFoundError('User not found in this tenant');
        }

        // Check if already a member
        const existingMember = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: data.userId } },
        });
        if (existingMember) {
            throw new ConflictError('User is already a member of this organization');
        }

        // Create member and assign role in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Determine the role to assign
            let role;
            if (data.roleId) {
                // Use explicitly provided roleId
                role = await tx.role.findFirst({
                    where: { id: data.roleId, tenantId },
                });
                if (!role) {
                    throw new NotFoundError('Role not found');
                }
            } else {
                // Fall back to auto-detected role based on organization type
                const primaryTypeCode = await this.getPrimaryTypeCode(organizationId);
                const roleName = primaryTypeCode ? this.getRoleNameForOrgTypeCode(primaryTypeCode) : 'user';

                role = await tx.role.findFirst({
                    where: { name: roleName, tenantId },
                });

                if (!role) {
                    // Create the role with appropriate permissions
                    role = await tx.role.create({
                        data: {
                            name: roleName,
                            description: `${roleName} role for organization members`,
                            tenantId,
                            isSystem: false,
                        },
                    });
                    console.log(`[OrganizationService] Created role: ${roleName}`);
                }
            }

            // Create organization member with primary org role
            const member = await tx.organizationMember.create({
                data: {
                    organizationId,
                    userId: data.userId,
                    roleId: role.id,
                    title: data.title,
                    department: data.department,
                    employeeId: data.employeeId,
                    joinedAt: new Date(),
                },
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                    organization: {
                        select: { id: true, name: true },
                    },
                },
            });

            // Assign the role to the user via TenantMembership
            // IMPORTANT: Only set roleId on CREATE (new membership).
            // On UPDATE, do NOT overwrite the existing role — the user may already
            // have a higher-privilege role (e.g., admin from bootstrap) that should
            // not be downgraded when they're added to an organization.
            const membership = await tx.tenantMembership.upsert({
                where: { userId_tenantId: { userId: data.userId, tenantId } },
                create: {
                    userId: data.userId,
                    tenantId,
                    roleId: role.id,
                    isActive: true,
                },
                update: {
                    isActive: true,
                },
            });

            const additionalRoleIds = [...new Set(data.additionalRoleIds ?? [])]
                .filter((id) => id && id !== role.id);

            if (additionalRoleIds.length > 0) {
                const additionalRoles = await tx.role.findMany({
                    where: {
                        id: { in: additionalRoleIds },
                        tenantId,
                        isActive: true,
                    },
                    select: { id: true },
                });

                if (additionalRoles.length !== additionalRoleIds.length) {
                    throw new ValidationError('One or more additional roles are invalid for this tenant');
                }

                for (const additionalRoleId of additionalRoleIds) {
                    await tx.organizationMemberRole.upsert({
                        where: {
                            organizationMemberId_roleId: {
                                organizationMemberId: member.id,
                                roleId: additionalRoleId,
                            },
                        },
                        update: {},
                        create: {
                            organizationMemberId: member.id,
                            roleId: additionalRoleId,
                        },
                    });
                }
            }

            // Multi-role support at tenant level: keep non-primary org roles as additive tenant roles.
            const tenantAdditiveRoleIds = [...new Set([role.id, ...(data.additionalRoleIds ?? [])])]
                .filter((id) => id && id !== membership.roleId);

            for (const additiveRoleId of tenantAdditiveRoleIds) {
                await tx.tenantMembershipRole.upsert({
                    where: {
                        tenantMembershipId_roleId: {
                            tenantMembershipId: membership.id,
                            roleId: additiveRoleId,
                        },
                    },
                    update: {},
                    create: {
                        tenantMembershipId: membership.id,
                        roleId: additiveRoleId,
                    },
                });
            }

            return { member, role };
        });

        return result.member;
    }

    /**
     * Get organization members.
     */
    async getMembers(tenantId: string, organizationId: string) {
        await this.findById(tenantId, organizationId);

        return prisma.organizationMember.findMany({
            where: { organizationId },
            include: {
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
                role: { select: { id: true, name: true } },
                additionalRoles: {
                    include: { role: { select: { id: true, name: true } } },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * Update a member's details.
     */
    async updateMember(tenantId: string, organizationId: string, memberId: string, data: UpdateMemberInput) {
        await this.findById(tenantId, organizationId);

        const member = await prisma.organizationMember.findFirst({
            where: { id: memberId, organizationId },
        });
        if (!member) {
            throw new NotFoundError('Member not found');
        }

        return prisma.$transaction(async (tx) => {
            const scalarUpdate: any = {
                title: data.title,
                department: data.department,
                employeeId: data.employeeId,
                isActive: data.isActive,
            };

            if (data.roleId) {
                const role = await tx.role.findFirst({
                    where: { id: data.roleId, tenantId, isActive: true },
                    select: { id: true },
                });
                if (!role) {
                    throw new ValidationError('Invalid roleId for this tenant');
                }
                scalarUpdate.roleId = data.roleId;
            }

            const updatedMember = await tx.organizationMember.update({
                where: { id: memberId },
                data: scalarUpdate,
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                },
            });

            if (data.additionalRoleIds) {
                const additionalRoleIds = [...new Set(data.additionalRoleIds)]
                    .filter((id) => id && id !== updatedMember.roleId);

                const roles = await tx.role.findMany({
                    where: {
                        id: { in: additionalRoleIds },
                        tenantId,
                        isActive: true,
                    },
                    select: { id: true },
                });

                if (roles.length !== additionalRoleIds.length) {
                    throw new ValidationError('One or more additional roles are invalid for this tenant');
                }

                await tx.organizationMemberRole.deleteMany({
                    where: { organizationMemberId: memberId },
                });

                if (additionalRoleIds.length > 0) {
                    await tx.organizationMemberRole.createMany({
                        data: additionalRoleIds.map((roleId) => ({
                            organizationMemberId: memberId,
                            roleId,
                        })),
                    });
                }
            }

            return updatedMember;
        });
    }

    /**
     * Remove a member from an organization.
     */
    async removeMember(tenantId: string, organizationId: string, memberId: string) {
        await this.findById(tenantId, organizationId);

        const member = await prisma.organizationMember.findFirst({
            where: { id: memberId, organizationId },
        });
        if (!member) {
            throw new NotFoundError('Member not found');
        }

        return prisma.organizationMember.delete({
            where: { id: memberId },
        });
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Get default role for new organization members.
     * New members get the 'user' role by default; admins can assign additional roles later.
     * Note: Organization type does NOT determine role - roles are about what people can DO,
     * not what organization they belong to.
     */
    private getRoleNameForOrgTypeCode(_typeCode: string): string {
        // All new organization members get the 'user' role by default.
        // Additional roles (agent, mortgage_ops, lender_ops, etc.) should be
        // assigned explicitly based on the person's job responsibilities.
        return 'user';
    }

    /**
     * Get the primary type code of an organization.
     */
    private async getPrimaryTypeCode(organizationId: string): Promise<string | null> {
        const primaryAssignment = await prisma.organizationTypeAssignment.findFirst({
            where: { organizationId, isPrimary: true },
            include: { orgType: { select: { code: true } } },
        });
        return primaryAssignment?.orgType.code ?? null;
    }

}

export const organizationService = new OrganizationService();
