/**
 * DynamoDB Policy Repository
 * 
 * Manages role policies in DynamoDB for the authorizer service.
 * This is the write-side of the cache - the authorizer reads from this table.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    DeleteCommand,
    GetCommand,
    UpdateCommand,
    BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../lib/config';

export interface RolePolicyItem {
    PK: string;          // ROLE#roleName
    SK: string;          // POLICY
    roleName: string;
    scopes: string[];    // Array of scope strings like "users:read", "properties:write"
    isActive: boolean;
    tenantId?: string;
    GSI1PK?: string;     // TENANT#tenantId (for tenant-specific queries)
    GSI1SK?: string;     // ROLE#roleName
    updatedAt: string;
}

export class DynamoPolicyRepository {
    private readonly client: DynamoDBClient;
    private readonly docClient: DynamoDBDocumentClient;
    private readonly tableName: string;

    constructor() {
        const config = getConfig();

        const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = {
            region: config.awsRegion,
        };

        // Use LocalStack endpoint if configured
        if (config.localstackEndpoint) {
            clientConfig.endpoint = config.localstackEndpoint;
            clientConfig.credentials = {
                accessKeyId: 'test',
                secretAccessKey: 'test',
            };
        }

        this.client = new DynamoDBClient(clientConfig);
        this.docClient = DynamoDBDocumentClient.from(this.client);
        this.tableName = config.rolePoliciesTableName;
    }

    /**
     * Upsert a role policy - creates or updates
     */
    async upsertRolePolicy(
        roleName: string,
        scopes: string[],
        options?: { tenantId?: string; isActive?: boolean }
    ): Promise<void> {
        const now = new Date().toISOString();

        const item: RolePolicyItem = {
            PK: `ROLE#${roleName}`,
            SK: 'POLICY',
            roleName,
            scopes,
            isActive: options?.isActive ?? true,
            updatedAt: now,
        };

        // Add tenant-specific GSI keys if tenantId provided
        if (options?.tenantId) {
            item.tenantId = options.tenantId;
            item.GSI1PK = `TENANT#${options.tenantId}`;
            item.GSI1SK = `ROLE#${roleName}`;
        }

        const command = new PutCommand({
            TableName: this.tableName,
            Item: item,
        });

        await this.docClient.send(command);
        console.log(`[DynamoPolicyRepository] Upserted policy for role: ${roleName} with ${scopes.length} scopes`);
    }

    /**
     * Get a role policy by name
     */
    async getRolePolicy(roleName: string): Promise<RolePolicyItem | null> {
        const command = new GetCommand({
            TableName: this.tableName,
            Key: {
                PK: `ROLE#${roleName}`,
                SK: 'POLICY',
            },
        });

        const response = await this.docClient.send(command);
        return response.Item as RolePolicyItem | null;
    }

    /**
     * Delete a role policy
     */
    async deleteRolePolicy(roleName: string): Promise<void> {
        const command = new DeleteCommand({
            TableName: this.tableName,
            Key: {
                PK: `ROLE#${roleName}`,
                SK: 'POLICY',
            },
        });

        await this.docClient.send(command);
        console.log(`[DynamoPolicyRepository] Deleted policy for role: ${roleName}`);
    }

    /**
     * Update role policy active status
     */
    async setRolePolicyActive(roleName: string, isActive: boolean): Promise<void> {
        const command = new UpdateCommand({
            TableName: this.tableName,
            Key: {
                PK: `ROLE#${roleName}`,
                SK: 'POLICY',
            },
            UpdateExpression: 'SET isActive = :active, updatedAt = :now',
            ExpressionAttributeValues: {
                ':active': isActive,
                ':now': new Date().toISOString(),
            },
        });

        await this.docClient.send(command);
        console.log(`[DynamoPolicyRepository] Set role ${roleName} active: ${isActive}`);
    }

    /**
     * Batch upsert multiple role policies
     */
    async batchUpsertPolicies(policies: Array<{
        roleName: string;
        scopes: string[];
        tenantId?: string;
        isActive?: boolean;
    }>): Promise<void> {
        if (policies.length === 0) return;

        const now = new Date().toISOString();
        const batchSize = 25; // DynamoDB batch write limit

        for (let i = 0; i < policies.length; i += batchSize) {
            const batch = policies.slice(i, i + batchSize);

            const putRequests = batch.map(policy => {
                const item: RolePolicyItem = {
                    PK: `ROLE#${policy.roleName}`,
                    SK: 'POLICY',
                    roleName: policy.roleName,
                    scopes: policy.scopes,
                    isActive: policy.isActive ?? true,
                    updatedAt: now,
                };

                if (policy.tenantId) {
                    item.tenantId = policy.tenantId;
                    item.GSI1PK = `TENANT#${policy.tenantId}`;
                    item.GSI1SK = `ROLE#${policy.roleName}`;
                }

                return {
                    PutRequest: { Item: item },
                };
            });

            const command = new BatchWriteCommand({
                RequestItems: {
                    [this.tableName]: putRequests,
                },
            });

            await this.docClient.send(command);
            console.log(`[DynamoPolicyRepository] Batch upserted ${batch.length} policies`);
        }
    }

    /**
     * Convert permissions to scopes
     * Format: "resource:action" e.g., "users:read", "properties:write"
     */
    static permissionsToScopes(permissions: Array<{ resource: string; action: string }>): string[] {
        return permissions.map(p => `${p.resource}:${p.action}`);
    }
}

// Singleton instance
let repository: DynamoPolicyRepository | null = null;

export function getDynamoPolicyRepository(): DynamoPolicyRepository {
    if (!repository) {
        repository = new DynamoPolicyRepository();
    }
    return repository;
}
