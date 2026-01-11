import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    ConflictError,
    PolicyEventPublisher,
} from '@valentine-efagene/qshelter-common';

// Initialize policy event publisher for permission changes
const policyPublisher = new PolicyEventPublisher('user-service', {
    region: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    topicArn: process.env.POLICY_SYNC_TOPIC_ARN,
});

export interface CreatePermissionInput {
    name: string;
    description?: string;
    resource: string;
    action: string;
}

export interface UpdatePermissionInput {
    name?: string;
    description?: string;
    resource?: string;
    action?: string;
}

class PermissionService {
    async create(data: CreatePermissionInput) {
        // Check for unique name
        const existingByName = await prisma.permission.findUnique({ where: { name: data.name } });
        if (existingByName) {
            throw new ConflictError('Permission name already exists');
        }

        // Check for unique resource+action combo
        const existingByResourceAction = await prisma.permission.findFirst({
            where: {
                resource: data.resource,
                action: data.action,
            },
        });
        if (existingByResourceAction) {
            throw new ConflictError(`Permission for ${data.resource}:${data.action} already exists`);
        }

        const permission = await prisma.permission.create({
            data: {
                name: data.name,
                description: data.description,
                resource: data.resource,
                action: data.action,
            },
        });

        // Publish permission created event
        try {
            await policyPublisher.publishPermissionCreated({
                id: permission.id,
                name: permission.name,
                description: permission.description,
                resource: permission.resource,
                action: permission.action,
            });
            console.log(`[PermissionService] Published PERMISSION_CREATED event for ${permission.name}`);
        } catch (error) {
            console.error(`[PermissionService] Failed to publish PERMISSION_CREATED event:`, error);
        }

        return permission;
    }

    async findAll() {
        return prisma.permission.findMany({
            orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        });
    }

    async findById(id: string) {
        const permission = await prisma.permission.findUnique({
            where: { id },
        });

        if (!permission) {
            throw new NotFoundError('Permission not found');
        }

        return permission;
    }

    async findByResourceAction(resource: string, action: string) {
        const permission = await prisma.permission.findFirst({
            where: { resource, action },
        });

        if (!permission) {
            throw new NotFoundError(`Permission for ${resource}:${action} not found`);
        }

        return permission;
    }

    async update(id: string, data: UpdatePermissionInput) {
        const permission = await prisma.permission.findUnique({ where: { id } });
        if (!permission) {
            throw new NotFoundError('Permission not found');
        }

        // Check unique constraints if updating relevant fields
        if (data.name && data.name !== permission.name) {
            const existingByName = await prisma.permission.findUnique({ where: { name: data.name } });
            if (existingByName) {
                throw new ConflictError('Permission name already exists');
            }
        }

        if (data.resource || data.action) {
            const newResource = data.resource || permission.resource;
            const newAction = data.action || permission.action;

            if (newResource !== permission.resource || newAction !== permission.action) {
                const existing = await prisma.permission.findFirst({
                    where: { resource: newResource, action: newAction },
                });
                if (existing && existing.id !== id) {
                    throw new ConflictError(`Permission for ${newResource}:${newAction} already exists`);
                }
            }
        }

        const updatedPermission = await prisma.permission.update({
            where: { id },
            data,
        });

        // Publish permission updated event
        try {
            await policyPublisher.publishPermissionUpdated({
                id: updatedPermission.id,
                name: updatedPermission.name,
                description: updatedPermission.description,
                resource: updatedPermission.resource,
                action: updatedPermission.action,
            });
            console.log(`[PermissionService] Published PERMISSION_UPDATED event for ${updatedPermission.name}`);
        } catch (error) {
            console.error(`[PermissionService] Failed to publish PERMISSION_UPDATED event:`, error);
        }

        return updatedPermission;
    }

    async delete(id: string) {
        const permission = await prisma.permission.findUnique({ where: { id } });
        if (!permission) {
            throw new NotFoundError('Permission not found');
        }

        await prisma.permission.delete({ where: { id } });

        // Publish permission deleted event
        try {
            await policyPublisher.publishPermissionDeleted(id);
            console.log(`[PermissionService] Published PERMISSION_DELETED event for ${permission.name}`);
        } catch (error) {
            console.error(`[PermissionService] Failed to publish PERMISSION_DELETED event:`, error);
        }
    }

    /**
     * Assign permissions to a role
     */
    async assignToRole(roleId: string, permissionIds: string[]) {
        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) {
            throw new NotFoundError('Role not found');
        }

        // Verify all permissions exist
        const permissions = await prisma.permission.findMany({
            where: { id: { in: permissionIds } },
        });

        if (permissions.length !== permissionIds.length) {
            throw new NotFoundError('One or more permissions not found');
        }

        // Delete existing role-permission associations
        await prisma.rolePermission.deleteMany({
            where: { roleId },
        });

        // Create new associations
        if (permissionIds.length > 0) {
            await prisma.rolePermission.createMany({
                data: permissionIds.map((permissionId) => ({
                    roleId,
                    permissionId,
                })),
            });
        }

        // Fetch the full role with permissions for the event
        const updatedRole = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });

        // Publish role permission assigned event
        try {
            await policyPublisher.publishRolePermissionAssigned({
                roleId: role.id,
                roleName: role.name,
                permissions: updatedRole!.permissions.map((rp) => ({
                    id: rp.permission.id,
                    resource: rp.permission.resource,
                    action: rp.permission.action,
                })),
            });
            console.log(`[PermissionService] Published ROLE_PERMISSION_ASSIGNED event for role ${role.name}`);
        } catch (error) {
            console.error(`[PermissionService] Failed to publish ROLE_PERMISSION_ASSIGNED event:`, error);
        }

        return updatedRole;
    }

    /**
     * Get permissions for a role
     */
    async getForRole(roleId: string) {
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        return role.permissions.map((rp) => rp.permission);
    }
}

export const permissionService = new PermissionService();
