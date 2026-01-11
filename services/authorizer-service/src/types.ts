import { APIGatewayAuthorizerResultContext } from 'aws-lambda';

/**
 * Resource within a policy statement
 */
export interface PolicyResource {
    path: string;
    methods: string[];
}

/**
 * Policy statement with effect and resources
 */
export interface PolicyStatement {
    effect: 'Allow' | 'Deny';
    resources: PolicyResource[];
}

/**
 * Role policy document stored in DynamoDB
 * Version 2 uses path-based authorization
 */
export interface RolePolicy {
    version: string;
    statements: PolicyStatement[];
}

/**
 * Role policy item stored in DynamoDB
 * Supports both global and tenant-scoped roles
 * 
 * Key formats:
 * - Global: PK = "ROLE#roleName"
 * - Tenant-scoped: PK = "TENANT#tenantId#ROLE#roleName"
 */
export interface RolePolicyItem {
    PK: string;
    SK: string; // Always "POLICY"
    roleName: string;
    policy?: RolePolicy;
    isActive: boolean;
    tenantId?: string;
    GSI1PK?: string; // TENANT#tenantId
    GSI1SK?: string; // ROLE#roleName
    updatedAt: string;
}

/**
 * Result of policy evaluation
 */
export interface PolicyEvaluationResult {
    allowed: boolean;
    matchedPolicy?: {
        roleName: string;
        path: string;
        methods: string[];
        effect: 'Allow' | 'Deny';
    };
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
    /** Role names for the current tenant context */
    roles: string[];
    /** Issued at timestamp */
    iat: number;
    /** Expiration timestamp */
    exp: number;
}

/**
 * Authorizer context passed to downstream Lambda functions
 */
export interface AuthorizerContext extends APIGatewayAuthorizerResultContext {
    userId: string;
    email: string;
    roles: string; // JSON stringified array
    tenantId: string;
    principalType: string;
    /** The full policy document for path-based authorization */
    policy?: string; // JSON stringified RolePolicy
}
