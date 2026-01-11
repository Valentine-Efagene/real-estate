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
}

export interface UpdateRoleInput {
    name?: string;
    description?: string;
}

class RoleService {
    async create(data: CreateRoleInput) {
        const existing = await prisma.role.findUnique({ where: { name: data.name } });
        if (existing) {
            throw new ConflictError('Role name already exists');
        }

        const role = await prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
            },
        });

        // Publish role created event for DynamoDB sync
        try {
            await policyPublisher.publishRoleCreated({
                id: role.id,
                name: role.name,
                description: role.description,
            });
            console.log(`[RoleService] Published ROLE_CREATED event for ${role.name}`);
        } catch (error) {
            console.error(`[RoleService] Failed to publish ROLE_CREATED event:`, error);
            // Don't fail the request - event will be synced on next full sync
        }

        return role;
    }

    async findAll() {
        return prisma.role.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async findById(id: string) {
        const role = await prisma.role.findUnique({
            where: { id },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        return role;
    }

    async update(id: string, data: UpdateRoleInput) {
        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) {
            throw new NotFoundError('Role not found');
        }

        if (data.name && data.name !== role.name) {
            const existing = await prisma.role.findUnique({ where: { name: data.name } });
            if (existing) {
                throw new ConflictError('Role name already exists');
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
            });
            console.log(`[RoleService] Published ROLE_UPDATED event for ${updatedRole.name}`);
        } catch (error) {
            console.error(`[RoleService] Failed to publish ROLE_UPDATED event:`, error);
        }

        return updatedRole;
    }

    async delete(id: string) {
        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) {
            throw new NotFoundError('Role not found');
        }

        const roleName = role.name;
        await prisma.role.delete({ where: { id } });

        // Publish role deleted event for DynamoDB sync
        try {
            await policyPublisher.publishRoleDeleted(id, roleName);
            console.log(`[RoleService] Published ROLE_DELETED event for ${roleName}`);
        } catch (error) {
            console.error(`[RoleService] Failed to publish ROLE_DELETED event:`, error);
        }
    }
}

export const roleService = new RoleService();
