import { DynamoDBClient, ScanCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { RolePolicyItem } from './types';

interface CacheEntry {
    scopes: string[];
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
     * Warm the cache by loading all active roles on cold start
     */
    async warmCache(): Promise<void> {
        if (this.cacheWarmed) {
            return;
        }

        try {
            const command = new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'begins_with(PK, :prefix)',
                FilterExpression: 'SK = :sk AND isActive = :active',
                ExpressionAttributeValues: {
                    ':prefix': 'ROLE#',
                    ':sk': 'POLICY',
                    ':active': true,
                },
            });

            // QueryCommand with begins_with on PK won't work directly
            // Use Scan instead for warming
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
                    const roleName = unmarshalled.roleName || unmarshalled.PK?.replace('ROLE#', '');
                    if (roleName) {
                        const scopes = this.extractScopesFromItem(unmarshalled);
                        this.cache.set(roleName, {
                            scopes,
                            expiresAt: now + CACHE_TTL_MS,
                        });
                    }
                }
            }

            this.cacheWarmed = true;
            console.log(`[PolicyRepository] Cache warmed with ${this.cache.size} roles`);
        } catch (error) {
            console.error('[PolicyRepository] Failed to warm cache:', error);
            // Don't throw - allow fallback to per-request fetching
        }
    }

    /**
     * Resolve roles to scopes using cache
     */
    async resolveScopes(roles: string[]): Promise<string[]> {
        if (!roles || roles.length === 0) {
            return [];
        }

        const allScopes: string[] = [];
        const now = Date.now();

        for (const role of roles) {
            const cached = this.cache.get(role);

            if (cached && cached.expiresAt > now) {
                // Cache hit
                allScopes.push(...cached.scopes);
            } else {
                // Cache miss - fetch from DynamoDB
                const scopes = await this.fetchRoleScopes(role);
                this.cache.set(role, {
                    scopes,
                    expiresAt: now + CACHE_TTL_MS,
                });
                allScopes.push(...scopes);
            }
        }

        // Deduplicate scopes
        return [...new Set(allScopes)];
    }

    /**
     * Fetch scopes for a single role from DynamoDB
     */
    private async fetchRoleScopes(role: string): Promise<string[]> {
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
                    return this.extractScopesFromItem(item);
                }
            }

            return [];
        } catch (error) {
            console.error(`[PolicyRepository] Error fetching role ${role}:`, error);
            return [];
        }
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
