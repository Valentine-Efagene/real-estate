import { APIGatewayAuthorizerResultContext } from 'aws-lambda';

export interface PolicyResource {
    path: string;
    methods: string[];
}

export interface PolicyStatement {
    effect: 'Allow' | 'Deny';
    resources: PolicyResource[];
}

export interface RolePolicy {
    version: string;
    statements: PolicyStatement[];
}

export interface RolePolicyItem {
    PK: string; // ROLE#roleName
    SK: string; // POLICY
    roleName: string;
    policy: RolePolicy;
    isActive: boolean;
    tenantId?: string;
    GSI1PK?: string; // TENANT#tenantId
    GSI1SK?: string; // ROLE#roleName
    updatedAt: string;
}

export interface JwtPayload {
    sub: string; // user id
    email: string;
    roles: string[];
    tenantId?: string;
    iat: number;
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
    tenantId: string;
}
