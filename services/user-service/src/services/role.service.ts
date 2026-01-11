import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    ConflictError,
    PolicyEventPublisher,
} from '@valentine-efagene/qshelter-common';

// Initialize policy event publisher for role changes
const policyPublisher = new PolicyEventPublisher('user-service', {
    region: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    topicArn: process.env.POLICY_SYNC_TOPIC_ARN,
});

export interface CreateRoleInput {
    name: string;
    description?: string;
    tenantId?: string | null;
    isSystem?: boolean;
}

export interface UpdateRoleInput {
    name?: string;
    description?: string;
    isActive?: boolean;
}

class RoleService {
    /**
     * Create a new role (global or tenant-specific)
     */
    async create(data: CreateRoleInput) {
        // Check for existing role with same name in same tenant scope
        const existing = await prisma.role.findFirst({
            where: {
                name: data.name,
                tenantId: data.tenantId ?? null,
            },
        });

        if (existing) {
            throw new ConflictError('Role name already exists in this scope');
        }

        const role = await prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
                tenantId: data.tenantId ?? null,
                isSystem: data.isSystem ?? false,
                isActive: true,
            },
        });

        // Publish role created event for DynamoDB sync
        try {
            await policyPublisher.publishRoleCreated({
                id: role.id,
                name: role.name,
                description: role.description,
                tenantId: role.tenantId,
                isSystem: role.isSystem,
                isActive: role.isActive,
            });
            console.log(`[RoleService] Published ROLE_CREATED event for ${role.name} (tenant: ${role.tenantId || 'global'})`);
        } catch (error) {
            console.error(`[RoleService] Failed to publish ROLE_CREATED event:`, error);
        }

        return role;
    }

    /**
     * Find all roles (global + tenant-specific for given tenant)
     */
    async findAll(tenantId?: string) {
        // If tenantId provided, return global roles + tenant-specific roles
        // Otherwise, return only global roles
        const where = tenantId
            ? {
                OR: [
                    { tenantId: null },
                    { tenantId },
                ],
            }
            : { tenantId: null };

        return prisma.role.findMany({
            where,
            orderBy: [
                { tenantId: 'asc' }, // Global roles first
                { name: 'asc' },
            ],
        });
    }

    /**
     * Find role by ID
     */
    async findById(id: string) {
        const role = await prisma.role.findUnique({
            where: { id },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        return role;
    }

    /**
     * Find role by name and tenant
     */
    async findByName(name: string, tenantId?: string | null) {
        const role = await prisma.role.findFirst({
            where: {
                name,
                tenantId: tenantId ?? null,
            },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        return role;
    }

    /**
     * Update a role
     */
    async update(id: string, data: UpdateRoleInput) {
        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) {
            throw new NotFoundError('Role not found');
        }

        if (role.isSystem) {
            throw new ConflictError('System roles cannot be modified');
        }

        if (data.name && data.name !== role.name) {
            const existing = await prisma.role.findFirst({
                where: {
                    name: data.name,
                    tenantId: role.tenantId,
                    NOT: { id },
                },
            });
            if (existing) {
                throw new ConflictError('Role name already exists in this scope');
            }
        }

        const updatedRole = await prisma.role.update({
            where: { id },
            data,
        });

        // Publish role updated event for DynamoDB sync
        try {
            await policyPublisher.publishRoleUpdated({
                id: updatedRole.id,
                name: updatedRole.name,
                description: updatedRole.description,
                tenantId: updatedRole.tenantId,
                isSystem: updatedRole.isSystem,
                isActive: updatedRole.isActive,
            });
            console.log(`[RoleService] Published ROLE_UPDATED event for ${updatedRole.name}`);
        } catch (error) {
            console.error(`[RoleService] Failed to publish ROLE_UPDATED event:`, error);
        }

        return updatedRole;
    }

    /**
     * Delete a role
     */
    async delete(id: string) {
        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) {
            throw new NotFoundError('Role not found');
        }

        if (role.isSystem) {
            throw new ConflictError('System roles cannot be deleted');
        }

        const roleName = role.name;
        const tenantId = role.tenantId;
        await prisma.role.delete({ where: { id } });

        // Publish role deleted event for DynamoDB sync
        try {
            await policyPublisher.publishRoleDeleted(id, roleName, { tenantId: tenantId ?? undefined });
            console.log(`[RoleService] Published ROLE_DELETED event for ${roleName}`);
        } catch (error) {
            console.error(`[RoleService] Failed to publish ROLE_DELETED event:`, error);
        }

        return { id, name: roleName };
    }

    /**
     * Get role with permissions
     */
    async getRoleWithPermissions(id: string) {
        const role = await prisma.role.findUnique({
            where: { id },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        return role;
    }

    /**
     * Assign permissions to a role
     */
    async assignPermissions(roleId: string, permissionIds: string[]) {
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        // Delete existing role-permission associations and create new ones
        await prisma.$transaction([
            prisma.rolePermission.deleteMany({
                where: { roleId },
            }),
            prisma.rolePermission.createMany({
                data: permissionIds.map(permissionId => ({
                    roleId,
                    permissionId,
                })),
            }),
        ]);

        // Fetch updated role with permissions
        const updatedRole = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        // Publish role permission assigned event for DynamoDB sync
        try {
            const permissions = updatedRole!.permissions.map(rp => ({
                id: rp.permission.id,
                path: rp.permission.path,
                methods: rp.permission.methods as string[],
                effect: rp.permission.effect as 'ALLOW' | 'DENY',
            }));

            await policyPublisher.publishRolePermissionAssigned({
                roleId,
                roleName: role.name,
                tenantId: role.tenantId ?? undefined,
                permissions,
            });
            console.log(`[RoleService] Published ROLE_PERMISSION_ASSIGNED event for ${role.name}`);
        } catch (error) {
            console.error(`[RoleService] Failed to publish ROLE_PERMISSION_ASSIGNED event:`, error);
        }

        return updatedRole;
    }

    /**
     * Get role's permissions
     */
    async getPermissions(roleId: string) {
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        return role.permissions.map(rp => rp.permission);
    }
}

export const roleService = new RoleService();
