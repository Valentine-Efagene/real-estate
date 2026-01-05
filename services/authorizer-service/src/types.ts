import { APIGatewayAuthorizerResultContext } from 'aws-lambda';

/**
 * @deprecated Use path-based PolicyResource for backward compatibility only
 * New implementations should use scope-based authorization
 */
export interface PolicyResource {
    path: string;
    methods: string[];
}

/**
 * @deprecated Use scope-based authorization instead
 */
export interface PolicyStatement {
    effect: 'Allow' | 'Deny';
    resources: PolicyResource[];
}

/**
 * @deprecated Use scope-based authorization instead
 */
export interface RolePolicy {
    version: string;
    statements: PolicyStatement[];
}

/**
 * Role policy item stored in DynamoDB
 * Supports both legacy path-based and new scope-based authorization
 */
export interface RolePolicyItem {
    PK: string; // ROLE#roleName
    SK: string; // POLICY
    roleName: string;
    policy?: RolePolicy;
    /** New: direct scopes array for scope-based auth */
    scopes?: string[];
    isActive: boolean;
    tenantId?: string;
    GSI1PK?: string; // TENANT#tenantId
    GSI1SK?: string; // ROLE#roleName
    updatedAt: string;
}

export interface JwtPayload {
    /** User ID or API Key ID */
    sub: string;
    /** User email */
    email?: string;
    /** Tenant ID for multi-tenancy */
    tenantId: string;
    /** Type of principal */
    principalType?: 'user' | 'apiKey';
    /** Role IDs/names */
    roles: string[];
    /** Issued at timestamp */
    iat: number;
    /** Expiration timestamp */
    exp: number;
}

/**
 * Authorizer context that will be passed to downstream Lambda functions
 * Must extend APIGatewayAuthorizerResultContext which requires string index signature
 */
export interface AuthorizerContext extends APIGatewayAuthorizerResultContext {
    userId: string;
    email: string;
    roles: string; // JSON stringified array
    scopes: string; // JSON stringified array of resolved scopes
    tenantId: string;
    principalType: string;
}
