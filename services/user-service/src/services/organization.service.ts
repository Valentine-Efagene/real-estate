import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    ConflictError,
    ValidationError,
    PolicyEventPublisher,
    OrganizationType,
    OrganizationStatus,
    OrganizationRole,
} from '@valentine-efagene/qshelter-common';

// Initialize policy event publisher for DynamoDB sync (when org members get roles)
const policyPublisher = new PolicyEventPublisher('user-service', {
    region: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    topicArn: process.env.POLICY_SYNC_TOPIC_ARN,
});

// =============================================================================
// TYPES
// =============================================================================

export interface CreateOrganizationInput {
    name: string;
    type: OrganizationType;
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
    role?: OrganizationRole;
    title?: string;
    department?: string;
    employeeId?: string;
    canApprove?: boolean;
    approvalLimit?: number;
}

export interface UpdateMemberInput {
    role?: OrganizationRole;
    title?: string;
    department?: string;
    employeeId?: string;
    isActive?: boolean;
    canApprove?: boolean;
    approvalLimit?: number;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    type?: OrganizationType;
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
        // Normalize empty strings to undefined (so they become null in DB)
        // This prevents unique constraint issues with empty strings
        const normalizedData = {
            ...data,
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

        return prisma.organization.create({
            data: {
                tenantId,
                ...normalizedData,
                status: 'ACTIVE', // Auto-activate for now
            },
            include: {
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
     * Get organization by ID.
     */
    async findById(tenantId: string, id: string) {
        const org = await prisma.organization.findFirst({
            where: { id, tenantId },
            include: {
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
            type,
            status,
            search,
        } = params;

        const where: any = { tenantId };
        if (type) where.type = type;
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

        return prisma.organization.update({
            where: { id },
            data,
            include: {
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
        const org = await this.findById(tenantId, organizationId);

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

        // Determine the role name based on organization type
        const roleName = this.getRoleNameForOrgType(org.type);

        // Create member and assign role in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create organization member
            const member = await tx.organizationMember.create({
                data: {
                    organizationId,
                    userId: data.userId,
                    role: data.role || 'OFFICER',
                    title: data.title,
                    department: data.department,
                    employeeId: data.employeeId,
                    canApprove: data.canApprove || false,
                    approvalLimit: data.approvalLimit,
                    invitedAt: new Date(),
                    acceptedAt: new Date(), // Auto-accept for now
                },
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                    organization: {
                        select: { id: true, name: true, type: true },
                    },
                },
            });

            // Find or create the role for this org type
            let role = await tx.role.findFirst({
                where: { name: roleName, tenantId },
            });

            if (!role) {
                // Create the role with appropriate permissions
                role = await tx.role.create({
                    data: {
                        name: roleName,
                        description: `${roleName} role for ${org.type} organization members`,
                        tenantId,
                        isSystem: false,
                    },
                });
                console.log(`[OrganizationService] Created role: ${roleName}`);
            }

            // Assign the role to the user via TenantMembership
            await tx.tenantMembership.upsert({
                where: { userId_tenantId: { userId: data.userId, tenantId } },
                create: {
                    userId: data.userId,
                    tenantId,
                    roleId: role.id,
                    isActive: true,
                },
                update: {
                    roleId: role.id,
                    isActive: true,
                },
            });

            return { member, role };
        });

        // Publish policy sync event
        await this.publishPolicySyncEvent(tenantId);

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

        return prisma.organizationMember.update({
            where: { id: memberId },
            data,
            include: {
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
            },
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
     * Map organization type to role name.
     */
    private getRoleNameForOrgType(type: OrganizationType): string {
        switch (type) {
            case 'BANK':
                return 'LENDER';
            case 'DEVELOPER':
                return 'DEVELOPER';
            case 'LEGAL':
                return 'LEGAL';
            case 'INSURER':
                return 'INSURER';
            case 'GOVERNMENT':
                return 'GOVERNMENT';
            case 'PLATFORM':
                return 'admin';
            default:
                return 'user';
        }
    }

    /**
     * Publish policy sync event to trigger DynamoDB update.
     */
    private async publishPolicySyncEvent(tenantId: string) {
        try {
            await policyPublisher.publishRoleUpdated({
                id: 'ALL', // Signal full resync
                name: 'ALL',
                tenantId,
            });
        } catch (error) {
            console.error('[OrganizationService] Failed to publish policy sync event:', error);
            // Don't fail the operation if SNS publish fails
        }
    }
}

export const organizationService = new OrganizationService();
