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

export interface RolePolicyDocument {
    roleName: string;
    policy: RolePolicy;
    isActive: boolean;
    tenantId?: string;
}
