import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import type { BindOrganizationInput, UpdateOrganizationBindingInput } from '../validators/application-organization.validator';

// Use any to avoid complex type inference issues with Prisma client
type AnyPrismaClient = PrismaClient;

/**
 * Service for managing organization bindings to applications
 * 
 * This service controls which organizations (banks, developers, legal firms)
 * are authorized to interact with specific applications.
 */
export function createApplicationOrganizationService(prisma: AnyPrismaClient) {
    return {
        /**
         * Bind an organization to an application
         * The organization must have the specified type in their OrganizationTypeAssignment
         */
        async bindOrganization(
            applicationId: string,
            tenantId: string,
            input: BindOrganizationInput,
            assignedById: string
        ) {
            const { organizationId, organizationTypeCode, isPrimary, slaHours } = input;

            // Verify application exists
            const application = await prisma.application.findUnique({
                where: { id: applicationId },
            });
            if (!application) {
                throw new AppError(404, 'Application not found');
            }

            // Verify organization exists and belongs to tenant
            const organization: any = await prisma.organization.findFirst({
                where: { id: organizationId, tenantId },
                include: {
                    types: {
                        include: {
                            orgType: true,
                        },
                    },
                },
            });
            if (!organization) {
                throw new AppError(404, 'Organization not found');
            }

            // Look up the organization type by code
            const orgType = await prisma.organizationType.findUnique({
                where: { tenantId_code: { tenantId, code: organizationTypeCode } },
            });
            if (!orgType) {
                throw new AppError(400, `Organization type '${organizationTypeCode}' not found`);
            }

            // Verify organization has this type
            const hasType = organization.types.some((t: any) => t.orgType.code === organizationTypeCode);
            if (!hasType) {
                throw new AppError(400, `Organization '${organization.name}' does not have type '${organizationTypeCode}'`);
            }

            // Check if binding already exists
            const existingBinding = await prisma.applicationOrganization.findFirst({
                where: {
                    applicationId,
                    organizationId,
                    assignedAsTypeId: orgType.id,
                },
            });
            if (existingBinding) {
                throw new AppError(409, 'Organization is already bound to this application in this role');
            }

            // If isPrimary, unset any existing primary for this type
            if (isPrimary) {
                await prisma.applicationOrganization.updateMany({
                    where: {
                        applicationId,
                        assignedAsTypeId: orgType.id,
                        isPrimary: true,
                    },
                    data: { isPrimary: false },
                });
            }

            // Create the binding
            const binding = await prisma.applicationOrganization.create({
                data: {
                    tenantId,
                    applicationId,
                    organizationId,
                    assignedAsTypeId: orgType.id,
                    status: 'PENDING',
                    isPrimary: isPrimary ?? false,
                    slaHours,
                    assignedById,
                    assignedAt: new Date(),
                },
                include: {
                    organization: { select: { id: true, name: true } },
                    assignedAsType: { select: { code: true, name: true } },
                },
            });

            return binding;
        },

        /**
         * Get all organization bindings for an application
         */
        async getOrganizationBindings(applicationId: string) {
            const bindings = await prisma.applicationOrganization.findMany({
                where: { applicationId },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            status: true,
                        },
                    },
                    assignedAsType: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                },
                orderBy: [
                    { isPrimary: 'desc' },
                    { assignedAt: 'asc' },
                ],
            });

            return bindings;
        },

        /**
         * Get a specific organization binding
         */
        async getOrganizationBinding(bindingId: string) {
            const binding = await prisma.applicationOrganization.findUnique({
                where: { id: bindingId },
                include: {
                    organization: true,
                    assignedAsType: true,
                },
            });

            if (!binding) {
                throw new AppError(404, 'Organization binding not found');
            }

            return binding;
        },

        /**
         * Update an organization binding
         */
        async updateOrganizationBinding(
            bindingId: string,
            input: UpdateOrganizationBindingInput,
            updatedById: string
        ) {
            const binding = await prisma.applicationOrganization.findUnique({
                where: { id: bindingId },
            });

            if (!binding) {
                throw new AppError(404, 'Organization binding not found');
            }

            // If setting as primary, unset others
            if (input.isPrimary === true) {
                await prisma.applicationOrganization.updateMany({
                    where: {
                        applicationId: binding.applicationId,
                        assignedAsTypeId: binding.assignedAsTypeId,
                        id: { not: bindingId },
                        isPrimary: true,
                    },
                    data: { isPrimary: false },
                });
            }

            // Build update data
            const updateData: Record<string, unknown> = {};
            if (input.status) updateData.status = input.status;
            if (input.isPrimary !== undefined) updateData.isPrimary = input.isPrimary;
            if (input.slaHours !== undefined) updateData.slaHours = input.slaHours;
            if (input.offeredTerms) {
                updateData.offeredTerms = input.offeredTerms;
                updateData.termsOfferedAt = new Date();
            }

            // Handle status-specific timestamps
            if (input.status === 'ACTIVE') {
                updateData.activatedAt = new Date();
            } else if (input.status === 'COMPLETED') {
                updateData.completedAt = new Date();
            } else if (input.status === 'WITHDRAWN') {
                updateData.withdrawnAt = new Date();
            }

            const updated = await prisma.applicationOrganization.update({
                where: { id: bindingId },
                data: updateData,
                include: {
                    organization: { select: { id: true, name: true } },
                    assignedAsType: { select: { code: true, name: true } },
                },
            });

            return updated;
        },

        /**
         * Remove an organization binding
         */
        async unbindOrganization(bindingId: string) {
            const binding = await prisma.applicationOrganization.findUnique({
                where: { id: bindingId },
            });

            if (!binding) {
                throw new AppError(404, 'Organization binding not found');
            }

            await prisma.applicationOrganization.delete({
                where: { id: bindingId },
            });

            return { success: true };
        },

        /**
         * Check if an organization is bound to an application with a specific type
         * Used for authorization checks
         */
        async isOrganizationBound(
            applicationId: string,
            organizationId: string,
            organizationTypeCode?: string
        ): Promise<boolean> {
            const whereClause: Record<string, unknown> = {
                applicationId,
                organizationId,
                status: { in: ['PENDING', 'ACTIVE'] }, // Only active bindings count
            };

            // If type specified, check for that specific type
            if (organizationTypeCode) {
                const binding = await prisma.applicationOrganization.findFirst({
                    where: {
                        ...whereClause,
                        assignedAsType: { code: organizationTypeCode },
                    } as any,
                });
                return !!binding;
            }

            // Otherwise check for any binding
            const binding = await prisma.applicationOrganization.findFirst({
                where: whereClause as any,
            });
            return !!binding;
        },

        /**
         * Get the user's organization binding for an application (if any)
         * Used to check if a user's organization is bound to the application.
         * 
         * Note: We query through ApplicationOrganization with a nested filter on
         * organization.members to avoid querying OrganizationMember directly,
         * since that table is NOT tenant-scoped and the tenant prisma wrapper
         * would incorrectly inject tenantId.
         */
        async getUserOrganizationBinding(
            applicationId: string,
            userId: string,
            organizationTypeCode?: string
        ) {
            // Query application organizations where user is a member of the org
            // This uses relation filtering to avoid querying OrganizationMember directly
            // Include COMPLETED status - orgs that finished one phase may need access for other phases
            const baseWhere: Record<string, unknown> = {
                applicationId,
                status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] },
                organization: {
                    members: {
                        some: {
                            userId,
                            isActive: true,
                        },
                    },
                },
            };

            if (organizationTypeCode) {
                const binding = await prisma.applicationOrganization.findFirst({
                    where: {
                        ...baseWhere,
                        assignedAsType: { code: organizationTypeCode },
                    } as any,
                    include: {
                        organization: true,
                        assignedAsType: true,
                    },
                });
                return binding;
            }

            const binding = await prisma.applicationOrganization.findFirst({
                where: baseWhere as any,
                include: {
                    organization: true,
                    assignedAsType: true,
                },
            });
            return binding;
        },
    };
}
