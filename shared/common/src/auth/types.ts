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

// AuthorizerResultContext, ParsedAuthContextWithScopes, RoleDefinition removed.
// The Lambda authorizer and DynamoDB policy store have been eliminated.
// Auth is now handled by JWT verification in the shared Express middleware.
