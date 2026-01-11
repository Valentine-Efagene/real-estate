import { DynamoDBClient, ScanCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { RolePolicyItem, RolePolicy, PolicyStatement } from './types';

interface CacheEntry {
    scopes: string[];
    policy?: RolePolicy;
    expiresAt: number;
}

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

const client = new DynamoDBClient({ region: process.env.AWS_REGION_NAME || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export class PolicyRepository {
    private tableName: string;
    private cache: Map<string, CacheEntry>;
    private cacheWarmed: boolean;

    constructor() {
        this.tableName = process.env.ROLE_POLICIES_TABLE_NAME || 'role-policies';
        this.cache = new Map();
        this.cacheWarmed = false;
    }

    /**
     * Build cache key for a role with optional tenant scoping
     */
    private buildCacheKey(roleName: string, tenantId?: string): string {
        return tenantId ? `${tenantId}#${roleName}` : roleName;
    }

    /**
     * Build DynamoDB PK for a role
     */
    private buildPK(roleName: string, tenantId?: string): string {
        return tenantId
            ? `TENANT#${tenantId}#ROLE#${roleName}`
            : `ROLE#${roleName}`;
    }

    /**
     * Warm the cache by loading all active roles on cold start
     */
    async warmCache(): Promise<void> {
        if (this.cacheWarmed) {
            return;
        }

        try {
            // Scan all policy items
            const scanCommand = new ScanCommand({
                TableName: this.tableName,
                FilterExpression: 'SK = :sk',
                ExpressionAttributeValues: {
                    ':sk': { S: 'POLICY' },
                },
            });

            const response = await client.send(scanCommand);
            const now = Date.now();

            for (const item of response.Items || []) {
                const unmarshalled = unmarshall(item);
                if (unmarshalled.isActive !== false) {
                    const pk = unmarshalled.PK || '';
                    const roleName = unmarshalled.roleName;
                    const tenantId = unmarshalled.tenantId;

                    if (roleName) {
                        const cacheKey = this.buildCacheKey(roleName, tenantId);
                        const scopes = this.extractScopesFromItem(unmarshalled);
                        const policy = unmarshalled.policy as RolePolicy | undefined;

                        this.cache.set(cacheKey, {
                            scopes,
                            policy,
                            expiresAt: now + CACHE_TTL_MS,
                        });
                    }
                }
            }

            this.cacheWarmed = true;
            console.log(`[PolicyRepository] Cache warmed with ${this.cache.size} role policies`);
        } catch (error) {
            console.error('[PolicyRepository] Failed to warm cache:', error);
        }
    }

    /**
     * Get role policy for tenant-scoped authorization
     * Falls back to global role if tenant-specific role not found
     */
    async getRolePolicy(roleName: string, tenantId?: string): Promise<CacheEntry | null> {
        const now = Date.now();

        // First try tenant-scoped role
        if (tenantId) {
            const tenantCacheKey = this.buildCacheKey(roleName, tenantId);
            const tenantCached = this.cache.get(tenantCacheKey);

            if (tenantCached && tenantCached.expiresAt > now) {
                return tenantCached;
            }

            // Try fetching tenant-scoped role
            const tenantPolicy = await this.fetchRolePolicy(roleName, tenantId);
            if (tenantPolicy) {
                this.cache.set(tenantCacheKey, tenantPolicy);
                return tenantPolicy;
            }
        }

        // Fall back to global role
        const globalCacheKey = this.buildCacheKey(roleName);
        const globalCached = this.cache.get(globalCacheKey);

        if (globalCached && globalCached.expiresAt > now) {
            return globalCached;
        }

        const globalPolicy = await this.fetchRolePolicy(roleName);
        if (globalPolicy) {
            this.cache.set(globalCacheKey, globalPolicy);
            return globalPolicy;
        }

        return null;
    }

    /**
     * Fetch role policy from DynamoDB
     */
    private async fetchRolePolicy(roleName: string, tenantId?: string): Promise<CacheEntry | null> {
        try {
            const pk = this.buildPK(roleName, tenantId);

            const command = new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk AND SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':sk': 'POLICY',
                },
            });

            const response = await docClient.send(command);

            if (response.Items && response.Items.length > 0) {
                const item = response.Items[0] as RolePolicyItem;
                if (item.isActive) {
                    return {
                        scopes: this.extractScopesFromItem(item),
                        policy: item.policy,
                        expiresAt: Date.now() + CACHE_TTL_MS,
                    };
                }
            }

            return null;
        } catch (error) {
            console.error(`[PolicyRepository] Error fetching role ${roleName}:`, error);
            return null;
        }
    }

    /**
     * Resolve roles to combined policy for tenant context
     */
    async resolvePolicies(roles: string[], tenantId?: string): Promise<{ scopes: string[]; policy: RolePolicy }> {
        const allScopes: Set<string> = new Set();
        const allStatements: PolicyStatement[] = [];

        for (const role of roles) {
            const entry = await this.getRolePolicy(role, tenantId);
            if (entry) {
                entry.scopes.forEach(s => allScopes.add(s));
                if (entry.policy?.statements) {
                    allStatements.push(...entry.policy.statements);
                }
            }
        }

        return {
            scopes: Array.from(allScopes),
            policy: {
                version: '2',
                statements: allStatements,
            },
        };
    }

    /**
     * Extract scopes from a role policy item
     * Supports both new scope-based and legacy path-based policies
     */
    private extractScopesFromItem(item: Record<string, any>): string[] {
        // If the item already has scopes array, use it directly
        if (item.scopes && Array.isArray(item.scopes)) {
            return item.scopes;
        }

        // Convert legacy path-based policy to scopes
        const scopes: Set<string> = new Set();
        const policy = item.policy;

        if (!policy?.statements) {
            return [];
        }

        for (const statement of policy.statements) {
            if (statement.effect !== 'Allow') continue;

            for (const resource of statement.resources || []) {
                const path = resource.path || '';
                const methods = resource.methods || [];

                const resourceName = this.extractResourceName(path);

                for (const method of methods) {
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

        const singularMap: Record<string, string> = {
            'contracts': 'contract',
            'users': 'user',
            'properties': 'property',
            'payments': 'payment',
            'tenants': 'tenant',
            'documents': 'document',
            'phases': 'phase',
            'installments': 'installment',
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
     * Invalidate a specific role in the cache
     */
    invalidateRole(roleId: string): void {
        this.cache.delete(roleId);
    }

    /**
     * Clear the entire cache
     */
    clearCache(): void {
        this.cache.clear();
        this.cacheWarmed = false;
    }

    /**
     * @deprecated Use resolveScopes instead
     * Kept for backward compatibility
     */
    async getPoliciesForRoles(roles: string[]): Promise<RolePolicyItem[]> {
        const policies: RolePolicyItem[] = [];

        for (const role of roles) {
            try {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk AND SK = :sk',
                    ExpressionAttributeValues: {
                        ':pk': `ROLE#${role}`,
                        ':sk': 'POLICY',
                    },
                });

                const response = await docClient.send(command);

                if (response.Items && response.Items.length > 0) {
                    const item = response.Items[0] as RolePolicyItem;
                    if (item.isActive) {
                        policies.push(item);
                    }
                }
            } catch (error) {
                console.error(`Error fetching policy for role ${role}:`, error);
            }
        }

        return policies;
    }

    /**
     * @deprecated
     */
    async getPolicyByRoleAndTenant(role: string, tenantId: string): Promise<RolePolicyItem | null> {
        try {
            const command = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk',
                ExpressionAttributeValues: {
                    ':gsi1pk': `TENANT#${tenantId}`,
                    ':gsi1sk': `ROLE#${role}`,
                },
            });

            const response = await docClient.send(command);

            if (response.Items && response.Items.length > 0) {
                const item = response.Items[0] as RolePolicyItem;
                return item.isActive ? item : null;
            }

            return null;
        } catch (error) {
            console.error(`Error fetching policy for role ${role} and tenant ${tenantId}:`, error);
            return null;
        }
    }
}
