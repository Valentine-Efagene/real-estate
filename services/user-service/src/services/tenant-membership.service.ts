import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    ConflictError,
    PolicyEventPublisher,
} from '@valentine-efagene/qshelter-common';

// Initialize policy event publisher for membership changes
const policyPublisher = new PolicyEventPublisher('user-service', {
    region: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    topicArn: process.env.POLICY_SYNC_TOPIC_ARN,
});

export interface CreateTenantMembershipInput {
    userId: string;
    tenantId: string;
    roleId: string;
    isDefault?: boolean;
}

export interface UpdateTenantMembershipInput {
    roleId?: string;
    isActive?: boolean;
    isDefault?: boolean;
}

class TenantMembershipService {
    /**
     * Add a user to a tenant with a specific role
     */
    async create(data: CreateTenantMembershipInput) {
        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id: data.userId } });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Verify tenant exists
        const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId } });
        if (!tenant) {
            throw new NotFoundError('Tenant not found');
        }

        // Verify role exists
        const role = await prisma.role.findUnique({ where: { id: data.roleId } });
        if (!role) {
            throw new NotFoundError('Role not found');
        }

        // Check if membership already exists
        const existing = await prisma.tenantMembership.findUnique({
            where: {
                userId_tenantId: {
                    userId: data.userId,
                    tenantId: data.tenantId,
                },
            },
        });
        if (existing) {
            throw new ConflictError('User is already a member of this tenant');
        }

        // If this is the default, unset other defaults for this user
        if (data.isDefault) {
            await prisma.tenantMembership.updateMany({
                where: { userId: data.userId, isDefault: true },
                data: { isDefault: false },
            });
        }

        const membership = await prisma.tenantMembership.create({
            data: {
                userId: data.userId,
                tenantId: data.tenantId,
                roleId: data.roleId,
                isActive: true,
                isDefault: data.isDefault ?? false,
            },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                tenant: { select: { id: true, name: true, subdomain: true } },
                role: { select: { id: true, name: true, description: true } },
            },
        });

        // Publish membership created event
        try {
            await policyPublisher.publishTenantMembershipCreated({
                id: membership.id,
                userId: membership.userId,
                tenantId: membership.tenantId,
                roleId: membership.roleId,
                roleName: role.name,
                isActive: membership.isActive,
                isDefault: membership.isDefault,
            });
            console.log(`[TenantMembershipService] Published TENANT_MEMBERSHIP_CREATED for user ${data.userId} in tenant ${data.tenantId}`);
        } catch (error) {
            console.error(`[TenantMembershipService] Failed to publish event:`, error);
        }

        return membership;
    }

    /**
     * Get all memberships for a user (all tenants they belong to)
     */
    async findByUser(userId: string) {
        return prisma.tenantMembership.findMany({
            where: { userId, isActive: true },
            include: {
                tenant: { select: { id: true, name: true, subdomain: true } },
                role: { select: { id: true, name: true, description: true } },
            },
            orderBy: [
                { isDefault: 'desc' }, // Default tenant first
                { tenant: { name: 'asc' } },
            ],
        });
    }

    /**
     * Get all members of a tenant
     */
    async findByTenant(tenantId: string, includeInactive = false) {
        return prisma.tenantMembership.findMany({
            where: {
                tenantId,
                ...(includeInactive ? {} : { isActive: true }),
            },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                role: { select: { id: true, name: true, description: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a specific membership
     */
    async findById(id: string) {
        const membership = await prisma.tenantMembership.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                tenant: { select: { id: true, name: true, subdomain: true } },
                role: { select: { id: true, name: true, description: true } },
            },
        });

        if (!membership) {
            throw new NotFoundError('Tenant membership not found');
        }

        return membership;
    }

    /**
     * Get membership for a specific user in a specific tenant
     */
    async findByUserAndTenant(userId: string, tenantId: string) {
        const membership = await prisma.tenantMembership.findUnique({
            where: {
                userId_tenantId: { userId, tenantId },
            },
            include: {
                tenant: { select: { id: true, name: true, subdomain: true } },
                role: {
                    select: { id: true, name: true, description: true },
                    include: {
                        permissions: {
                            include: { permission: true },
                        },
                    },
                },
            },
        });

        if (!membership) {
            throw new NotFoundError('User is not a member of this tenant');
        }

        return membership;
    }

    /**
     * Update a membership (change role, active status, default status)
     */
    async update(id: string, data: UpdateTenantMembershipInput) {
        const membership = await prisma.tenantMembership.findUnique({ where: { id } });
        if (!membership) {
            throw new NotFoundError('Tenant membership not found');
        }

        // If setting as default, unset other defaults for this user
        if (data.isDefault) {
            await prisma.tenantMembership.updateMany({
                where: { userId: membership.userId, isDefault: true, NOT: { id } },
                data: { isDefault: false },
            });
        }

        // If changing role, verify it exists
        if (data.roleId) {
            const role = await prisma.role.findUnique({ where: { id: data.roleId } });
            if (!role) {
                throw new NotFoundError('Role not found');
            }
        }

        const updatedMembership = await prisma.tenantMembership.update({
            where: { id },
            data,
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                tenant: { select: { id: true, name: true, subdomain: true } },
                role: { select: { id: true, name: true, description: true } },
            },
        });

        // Publish membership updated event
        try {
            await policyPublisher.publishTenantMembershipUpdated({
                id: updatedMembership.id,
                userId: updatedMembership.userId,
                tenantId: updatedMembership.tenantId,
                roleId: updatedMembership.roleId,
                roleName: updatedMembership.role.name,
                isActive: updatedMembership.isActive,
                isDefault: updatedMembership.isDefault,
            });
            console.log(`[TenantMembershipService] Published TENANT_MEMBERSHIP_UPDATED for membership ${id}`);
        } catch (error) {
            console.error(`[TenantMembershipService] Failed to publish event:`, error);
        }

        return updatedMembership;
    }

    /**
     * Remove a user from a tenant
     */
    async delete(id: string) {
        const membership = await prisma.tenantMembership.findUnique({
            where: { id },
            include: { role: true },
        });

        if (!membership) {
            throw new NotFoundError('Tenant membership not found');
        }

        await prisma.tenantMembership.delete({ where: { id } });

        // Publish membership deleted event
        try {
            await policyPublisher.publishTenantMembershipDeleted(
                membership.id,
                membership.userId,
                membership.tenantId
            );
            console.log(`[TenantMembershipService] Published TENANT_MEMBERSHIP_DELETED for membership ${id}`);
        } catch (error) {
            console.error(`[TenantMembershipService] Failed to publish event:`, error);
        }

        return { id };
    }

    /**
     * Get the default tenant for a user
     */
    async getDefaultTenant(userId: string) {
        const membership = await prisma.tenantMembership.findFirst({
            where: { userId, isDefault: true, isActive: true },
            include: {
                tenant: true,
                role: {
                    include: {
                        permissions: {
                            include: { permission: true },
                        },
                    },
                },
            },
        });

        if (!membership) {
            // Fall back to first active membership
            return prisma.tenantMembership.findFirst({
                where: { userId, isActive: true },
                include: {
                    tenant: true,
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            });
        }

        return membership;
    }

    /**
     * Set a tenant as the default for a user
     */
    async setDefaultTenant(userId: string, tenantId: string) {
        const membership = await prisma.tenantMembership.findUnique({
            where: { userId_tenantId: { userId, tenantId } },
        });

        if (!membership) {
            throw new NotFoundError('User is not a member of this tenant');
        }

        // Unset other defaults
        await prisma.tenantMembership.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
        });

        // Set this one as default
        return prisma.tenantMembership.update({
            where: { id: membership.id },
            data: { isDefault: true },
            include: {
                tenant: { select: { id: true, name: true, subdomain: true } },
                role: { select: { id: true, name: true, description: true } },
            },
        });
    }

    /**
     * Update a membership by user and tenant (for REST routes)
     */
    async updateByUserAndTenant(userId: string, tenantId: string, data: UpdateTenantMembershipInput) {
        const membership = await prisma.tenantMembership.findUnique({
            where: { userId_tenantId: { userId, tenantId } },
        });

        if (!membership) {
            throw new NotFoundError('User is not a member of this tenant');
        }

        return this.update(membership.id, data);
    }

    /**
     * Delete a membership by user and tenant (for REST routes)
     */
    async deleteByUserAndTenant(userId: string, tenantId: string) {
        const membership = await prisma.tenantMembership.findUnique({
            where: { userId_tenantId: { userId, tenantId } },
        });

        if (!membership) {
            throw new NotFoundError('User is not a member of this tenant');
        }

        return this.delete(membership.id);
    }
}

export const tenantMembershipService = new TenantMembershipService();
