/**
 * DynamoDB Policy Repository
 * 
 * Manages role policies in DynamoDB for the authorizer service.
 * This is the write-side of the cache - the authorizer reads from this table.
 * 
 * Key Structure:
 * - Global roles: PK = GLOBAL#ROLE#roleName, SK = POLICY
 * - Tenant roles: PK = TENANT#tenantId#ROLE#roleName, SK = POLICY
 * 
 * The authorizer looks up policies by tenant + role to get path-based permissions.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    DeleteCommand,
    GetCommand,
    UpdateCommand,
    BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../lib/config';

/**
 * Resource definition for path-based authorization
 */
export interface PolicyResource {
    path: string;       // Path pattern: /users, /users/:id, /properties/*
    methods: string[];  // HTTP methods: ['GET', 'POST'], ['*']
}

/**
 * Policy statement with effect and resources
 */
export interface PolicyStatement {
    effect: 'Allow' | 'Deny';
    resources: PolicyResource[];
}

/**
 * Full policy structure stored in DynamoDB
 */
export interface RolePolicy {
    version: string;          // Policy version: "2"
    statements: PolicyStatement[];
}

/**
 * Role policy item stored in DynamoDB
 * Supports both scope-based (legacy) and path-based authorization
 */
export interface RolePolicyItem {
    PK: string;               // GLOBAL#ROLE#name or TENANT#tenantId#ROLE#name
    SK: string;               // POLICY
    roleName: string;
    tenantId?: string;        // null/undefined = global role
    policy: RolePolicy;       // Full policy with statements
    scopes?: string[];        // Legacy: scope array for backward compatibility
    isActive: boolean;
    isSystem?: boolean;
    updatedAt: string;
    // GSI for tenant queries
    GSI1PK?: string;          // TENANT#tenantId or GLOBAL
    GSI1SK?: string;          // ROLE#roleName
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
     * Build the primary key for a role policy
     */
    private buildPK(roleName: string, tenantId?: string | null): string {
        if (tenantId) {
            return `TENANT#${tenantId}#ROLE#${roleName}`;
        }
        return `GLOBAL#ROLE#${roleName}`;
    }

    /**
     * Upsert a role policy with full path-based permissions
     */
    async upsertRolePolicy(
        roleName: string,
        policy: RolePolicy,
        options?: {
            tenantId?: string | null;
            isActive?: boolean;
            isSystem?: boolean;
            scopes?: string[];  // Legacy scope support
        }
    ): Promise<void> {
        const now = new Date().toISOString();
        const tenantId = options?.tenantId ?? null;

        const item: RolePolicyItem = {
            PK: this.buildPK(roleName, tenantId),
            SK: 'POLICY',
            roleName,
            policy,
            isActive: options?.isActive ?? true,
            updatedAt: now,
        };

        // Add optional fields
        if (tenantId) {
            item.tenantId = tenantId;
            item.GSI1PK = `TENANT#${tenantId}`;
        } else {
            item.GSI1PK = 'GLOBAL';
        }
        item.GSI1SK = `ROLE#${roleName}`;

        if (options?.isSystem !== undefined) {
            item.isSystem = options.isSystem;
        }

        // Include legacy scopes for backward compatibility
        if (options?.scopes) {
            item.scopes = options.scopes;
        } else {
            // Generate scopes from policy for backward compatibility
            item.scopes = this.policyToScopes(policy);
        }

        const command = new PutCommand({
            TableName: this.tableName,
            Item: item,
        });

        await this.docClient.send(command);
        console.log(`[DynamoPolicyRepository] Upserted policy for role: ${roleName} (tenant: ${tenantId || 'global'})`);
    }

    /**
     * Get a role policy by name and optional tenant
     */
    async getRolePolicy(roleName: string, tenantId?: string | null): Promise<RolePolicyItem | null> {
        const command = new GetCommand({
            TableName: this.tableName,
            Key: {
                PK: this.buildPK(roleName, tenantId),
                SK: 'POLICY',
            },
        });

        const response = await this.docClient.send(command);
        return response.Item as RolePolicyItem | null;
    }

    /**
     * Get a role policy, falling back to global if tenant-specific not found
     */
    async getRolePolicyWithFallback(roleName: string, tenantId?: string | null): Promise<RolePolicyItem | null> {
        // First try tenant-specific
        if (tenantId) {
            const tenantPolicy = await this.getRolePolicy(roleName, tenantId);
            if (tenantPolicy) {
                return tenantPolicy;
            }
        }

        // Fall back to global
        return this.getRolePolicy(roleName, null);
    }

    /**
     * Delete a role policy
     */
    async deleteRolePolicy(roleName: string, tenantId?: string | null): Promise<void> {
        const command = new DeleteCommand({
            TableName: this.tableName,
            Key: {
                PK: this.buildPK(roleName, tenantId),
                SK: 'POLICY',
            },
        });

        await this.docClient.send(command);
        console.log(`[DynamoPolicyRepository] Deleted policy for role: ${roleName} (tenant: ${tenantId || 'global'})`);
    }

    /**
     * Update role policy active status
     */
    async setRolePolicyActive(roleName: string, isActive: boolean, tenantId?: string | null): Promise<void> {
        const command = new UpdateCommand({
            TableName: this.tableName,
            Key: {
                PK: this.buildPK(roleName, tenantId),
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
        policy: RolePolicy;
        tenantId?: string | null;
        isActive?: boolean;
        isSystem?: boolean;
    }>): Promise<void> {
        if (policies.length === 0) return;

        const now = new Date().toISOString();
        const batchSize = 25; // DynamoDB batch write limit

        for (let i = 0; i < policies.length; i += batchSize) {
            const batch = policies.slice(i, i + batchSize);

            const putRequests = batch.map(p => {
                const tenantId = p.tenantId ?? null;

                const item: RolePolicyItem = {
                    PK: this.buildPK(p.roleName, tenantId),
                    SK: 'POLICY',
                    roleName: p.roleName,
                    policy: p.policy,
                    scopes: this.policyToScopes(p.policy),
                    isActive: p.isActive ?? true,
                    updatedAt: now,
                };

                if (tenantId) {
                    item.tenantId = tenantId;
                    item.GSI1PK = `TENANT#${tenantId}`;
                } else {
                    item.GSI1PK = 'GLOBAL';
                }
                item.GSI1SK = `ROLE#${p.roleName}`;

                if (p.isSystem !== undefined) {
                    item.isSystem = p.isSystem;
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
     * Convert path-based policy to legacy scopes for backward compatibility
     * Format: "resource:action" e.g., "users:read", "properties:write"
     */
    policyToScopes(policy: RolePolicy): string[] {
        const scopes = new Set<string>();

        for (const statement of policy.statements) {
            if (statement.effect !== 'Allow') continue;

            for (const resource of statement.resources) {
                const resourceName = this.extractResourceName(resource.path);

                for (const method of resource.methods) {
                    const action = this.methodToAction(method);

                    if (resourceName === '*' || action === '*') {
                        scopes.add('*');
                    } else if (resourceName && action) {
                        scopes.add(`${resourceName}:${action}`);
                    }
                }
            }
        }

        return Array.from(scopes);
    }

    /**
     * Extract resource name from path pattern
     */
    private extractResourceName(path: string): string {
        if (path === '/*' || path === '*') {
            return '*';
        }

        const segments = path.replace(/^\//, '').split('/');
        const firstSegment = segments[0] || '';

        // Singularize common resource names
        const singularMap: Record<string, string> = {
            'contracts': 'contract',
            'users': 'user',
            'properties': 'property',
            'payments': 'payment',
            'tenants': 'tenant',
            'documents': 'document',
            'phases': 'phase',
            'installments': 'installment',
            'roles': 'role',
            'permissions': 'permission',
            'mortgages': 'mortgage',
            'wallets': 'wallet',
            'amenities': 'amenity',
        };

        return singularMap[firstSegment] || firstSegment.replace(/s$/, '');
    }

    /**
     * Convert HTTP method to action
     */
    private methodToAction(method: string): string {
        const upper = method.toUpperCase();

        const methodMap: Record<string, string> = {
            'GET': 'read',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
            '*': '*',
        };

        return methodMap[upper] || 'read';
    }

    /**
     * Convert permissions from RDS to policy statements
     */
    static permissionsToPolicy(permissions: Array<{
        path: string;
        methods: string[];
        effect: 'ALLOW' | 'DENY';
    }>): RolePolicy {
        // Group permissions by effect
        const allowResources: PolicyResource[] = [];
        const denyResources: PolicyResource[] = [];

        for (const perm of permissions) {
            const resource: PolicyResource = {
                path: perm.path,
                methods: perm.methods,
            };

            if (perm.effect === 'ALLOW') {
                allowResources.push(resource);
            } else {
                denyResources.push(resource);
            }
        }

        const statements: PolicyStatement[] = [];

        if (allowResources.length > 0) {
            statements.push({
                effect: 'Allow',
                resources: allowResources,
            });
        }

        if (denyResources.length > 0) {
            statements.push({
                effect: 'Deny',
                resources: denyResources,
            });
        }

        return {
            version: '2',
            statements,
        };
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
