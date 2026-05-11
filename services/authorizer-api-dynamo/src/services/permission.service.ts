import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { AppError } from '../middleware/error-handler';
import { dynamodb, permissionsTableName } from '../lib/dynamodb';
import {
    createPermissionSchema,
    permissionSchema,
    type CreatePermissionInput,
    type Permission,
    type UpdatePermissionInput,
} from '../validators/permission.validator';

class PermissionService {
    async findAll(filters?: { roleName?: string; isActive?: boolean }) {
        const result = await dynamodb.send(
            new ScanCommand({
                TableName: permissionsTableName,
            })
        );

        let items = (result.Items ?? [])
            .map((item) => permissionSchema.safeParse(item))
            .filter((result): result is { success: true; data: Permission } => result.success)
            .map((result) => result.data);

        if (filters?.roleName) {
            const query = filters.roleName.toLowerCase();
            items = items.filter((item) => item.roleName.toLowerCase() === query);
        }

        if (typeof filters?.isActive === 'boolean') {
            items = items.filter((item) => item.isActive === filters.isActive);
        }

        return items.sort((a, b) => a.roleName.localeCompare(b.roleName));
    }

    async findByRoleName(roleName: string) {
        const permission = await this.findByRoleNameExact(roleName);

        if (!permission) {
            throw new AppError(404, 'Permission not found');
        }

        return permission;
    }

    async create(input: CreatePermissionInput) {
        const data = createPermissionSchema.parse(input);
        const existing = await this.findByRoleNameExact(data.roleName);

        if (existing) {
            throw new AppError(409, 'A permission with this roleName already exists');
        }

        const now = new Date().toISOString();
        const item: Permission = {
            id: Date.now(),
            roleName: data.roleName,
            isActive: data.isActive,
            policy: data.policy,
            createdAt: now,
            updatedAt: now,
        };

        await dynamodb.send(
            new PutCommand({
                TableName: permissionsTableName,
                Item: item,
                ConditionExpression: 'attribute_not_exists(roleName)',
            })
        );

        return item;
    }

    async updateByRoleName(roleName: string, input: UpdatePermissionInput) {
        const existing = await this.findByRoleName(roleName);

        const updated: Permission = permissionSchema.parse({
            ...existing,
            ...input,
            updatedAt: new Date().toISOString(),
        });

        await dynamodb.send(
            new PutCommand({
                TableName: permissionsTableName,
                Item: updated,
            })
        );

        return updated;
    }

    async deleteByRoleName(roleName: string) {
        const existing = await this.findByRoleName(roleName);
        await this.deleteByRoleNameStored(existing.roleName);
        return { roleName: existing.roleName };
    }

    private async findByRoleNameExact(roleName: string) {
        const normalizedRoleName = roleName.trim();

        try {
            const result = await dynamodb.send(
                new GetCommand({
                    TableName: permissionsTableName,
                    Key: { roleName: normalizedRoleName },
                })
            );

            return result.Item ? permissionSchema.parse(result.Item) : undefined;
        } catch (error) {
            if (!this.isKeySchemaMismatch(error)) {
                throw error;
            }
        }

        const items = await this.findAll();
        return items.find(
            (item) => item.roleName.toLowerCase() === normalizedRoleName.toLowerCase()
        );
    }

    private async deleteByRoleNameStored(roleName: string) {
        await dynamodb.send(
            new DeleteCommand({
                TableName: permissionsTableName,
                Key: { roleName },
            })
        );
    }

    private isKeySchemaMismatch(error: unknown) {
        return (
            typeof error === 'object' &&
            error !== null &&
            '__type' in error &&
            String(error.__type).includes('ValidationException')
        );
    }
}

export const permissionService = new PermissionService();
