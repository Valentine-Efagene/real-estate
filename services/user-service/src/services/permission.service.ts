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
    path: string;           // Path pattern: /users, /users/:id, /properties/*
    methods: string[];      // HTTP methods: ['GET', 'POST'], ['*']
    effect?: 'ALLOW' | 'DENY';
    tenantId?: string | null;
}

export interface UpdatePermissionInput {
    name?: string;
    description?: string;
    path?: string;
    methods?: string[];
    effect?: 'ALLOW' | 'DENY';
}

class PermissionService {
    /**
     * Create a new permission (global or tenant-specific)
     */
    async create(data: CreatePermissionInput) {
        // Check for unique path in same tenant scope
        const existingByPath = await prisma.permission.findFirst({
            where: {
                path: data.path,
                tenantId: data.tenantId ?? null,
            },
        });
        if (existingByPath) {
            throw new ConflictError(`Permission for path ${data.path} already exists in this scope`);
        }

        const permission = await prisma.permission.create({
            data: {
                name: data.name,
                description: data.description,
                path: data.path,
                methods: data.methods,
                effect: data.effect ?? 'ALLOW',
                tenantId: data.tenantId ?? null,
            },
        });

        // Publish permission created event
        try {
            await policyPublisher.publishPermissionCreated({
                id: permission.id,
                name: permission.name,
                description: permission.description,
                path: permission.path,
                methods: permission.methods as string[],
                effect: permission.effect as 'ALLOW' | 'DENY',
                tenantId: permission.tenantId,
            });
            console.log(`[PermissionService] Published PERMISSION_CREATED event for ${permission.name}`);
        } catch (error) {
            console.error(`[PermissionService] Failed to publish PERMISSION_CREATED event:`, error);
        }

        return permission;
    }

    /**
     * Find all permissions (global + tenant-specific for given tenant)
     */
    async findAll(tenantId?: string) {
        const where = tenantId
            ? {
                OR: [
                    { tenantId: null },
                    { tenantId },
                ],
            }
            : { tenantId: null };

        return prisma.permission.findMany({
            where,
            orderBy: [
                { tenantId: 'asc' },
                { path: 'asc' },
            ],
        });
    }

    /**
     * Find permission by ID
     */
    async findById(id: string) {
        const permission = await prisma.permission.findUnique({
            where: { id },
        });

        if (!permission) {
            throw new NotFoundError('Permission not found');
        }

        return permission;
    }

    /**
     * Find permission by path and tenant
     */
    async findByPath(path: string, tenantId?: string | null) {
        const permission = await prisma.permission.findFirst({
            where: {
                path,
                tenantId: tenantId ?? null,
            },
        });

        if (!permission) {
            throw new NotFoundError(`Permission for path ${path} not found`);
        }

        return permission;
    }

    /**
     * Update a permission
     */
    async update(id: string, data: UpdatePermissionInput) {
        const permission = await prisma.permission.findUnique({ where: { id } });
        if (!permission) {
            throw new NotFoundError('Permission not found');
        }

        if (permission.isSystem) {
            throw new ConflictError('System permissions cannot be modified');
        }

        if (data.path && data.path !== permission.path) {
            const existing = await prisma.permission.findFirst({
                where: {
                    path: data.path,
                    tenantId: permission.tenantId,
                    NOT: { id },
                },
            });
            if (existing) {
                throw new ConflictError(`Permission for path ${data.path} already exists in this scope`);
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
                path: updatedPermission.path,
                methods: updatedPermission.methods as string[],
                effect: updatedPermission.effect as 'ALLOW' | 'DENY',
                tenantId: updatedPermission.tenantId,
            });
            console.log(`[PermissionService] Published PERMISSION_UPDATED event for ${updatedPermission.name}`);
        } catch (error) {
            console.error(`[PermissionService] Failed to publish PERMISSION_UPDATED event:`, error);
        }

        return updatedPermission;
    }

    /**
     * Delete a permission
     */
    async delete(id: string) {
        const permission = await prisma.permission.findUnique({ where: { id } });
        if (!permission) {
            throw new NotFoundError('Permission not found');
        }

        if (permission.isSystem) {
            throw new ConflictError('System permissions cannot be deleted');
        }

        await prisma.permission.delete({ where: { id } });

        // Publish permission deleted event
        try {
            await policyPublisher.publishPermissionDeleted(id);
            console.log(`[PermissionService] Published PERMISSION_DELETED event for ${permission.name}`);
        } catch (error) {
            console.error(`[PermissionService] Failed to publish PERMISSION_DELETED event:`, error);
        }

        return { id, name: permission.name };
    }

    /**
     * Get roles that have this permission
     */
    async getRoles(permissionId: string) {
        const permission = await prisma.permission.findUnique({
            where: { id: permissionId },
            include: {
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        });

        if (!permission) {
            throw new NotFoundError('Permission not found');
        }

        return permission.roles.map(rp => rp.role);
    }

    /**
     * Bulk create permissions from path definitions
     */
    async bulkCreate(permissions: CreatePermissionInput[]) {
        const results = [];

        for (const perm of permissions) {
            try {
                const created = await this.create(perm);
                results.push({ success: true, permission: created });
            } catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    input: perm,
                });
            }
        }

        return results;
    }

    /**
     * Create standard CRUD permissions for a resource path
     * Creates two permissions: one for collection (list, create) and one for individual items (get, update, delete)
     */
    async createCrudPermissions(resourcePath: string, resourceName: string, tenantId?: string) {
        const crudOps = [
            { name: `Manage ${resourceName} Collection`, path: resourcePath, methods: ['GET', 'POST'] },
            { name: `Manage ${resourceName} Item`, path: `${resourcePath}/:id`, methods: ['GET', 'PUT', 'PATCH', 'DELETE'] },
        ];

        return this.bulkCreate(
            crudOps.map(op => ({
                ...op,
                tenantId,
                effect: 'ALLOW' as const,
            }))
        );
    }
}

export const permissionService = new PermissionService();
