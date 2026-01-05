/**
 * Auth types for JWT payloads and authorization context
 */

export interface JwtPayload {
    /** User ID or API Key ID */
    sub: string;
    /** User email (for user principals) */
    email?: string;
    /** Tenant ID for multi-tenancy */
    tenantId: string;
    /** Type of principal: user or apiKey */
    principalType: 'user' | 'apiKey';
    /** Role IDs/names (resolved to scopes via cache) */
    roles: string[];
    /** Issued at timestamp */
    iat: number;
    /** Expiration timestamp */
    exp: number;
}

/**
 * Authorization context passed to downstream services via API Gateway
 * All values must be strings for API Gateway context
 * 
 * @deprecated Use AuthContext from middleware/auth-context.ts for Express services
 */
export interface AuthorizerResultContext {
    /** User ID or API Key ID */
    principalId: string;
    /** Tenant ID */
    tenantId: string;
    /** Type of principal: user or apiKey */
    principalType: 'user' | 'apiKey';
    /** JSON stringified array of role names */
    roles: string;
    /** JSON stringified array of resolved scopes */
    scopes: string;
    /** User email (optional) */
    email?: string;
}

/**
 * Parsed auth context with scopes (after JSON parsing)
 */
export interface ParsedAuthContextWithScopes {
    principalId: string;
    tenantId: string;
    principalType: 'user' | 'apiKey';
    roles: string[];
    scopes: string[];
    email?: string;
}

/**
 * Role definition stored in DynamoDB
 */
export interface RoleDefinition {
    /** Role ID (partition key) */
    id: string;
    /** Human-readable role name */
    name: string;
    /** Description of the role */
    description?: string;
    /** Scopes granted by this role */
    scopes: string[];
    /** Whether the role is active */
    isActive: boolean;
    /** Tenant ID (null for global roles) */
    tenantId?: string;
    /** Last updated timestamp */
    updatedAt: string;
}
