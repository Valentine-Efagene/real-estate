import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewayAuthorizerResult,
    PolicyDocument,
    Statement as PolicyStatement
} from 'aws-lambda';
import { JwtService } from './jwt-service';
import { PolicyRepository } from './policy-repository';
import { AuthorizerContext, JwtPayload, RolePolicy } from './types';

/**
 * Authorizer service that validates JWTs and resolves role-based permissions
 * 
 * Flow:
 * 1. Extract and verify JWT from Authorization header
 * 2. Resolve roles to policies using in-memory cache (DynamoDB-backed)
 * 3. Return IAM policy with scopes and policy in context for downstream services
 * 
 * Tenant-scoped authorization:
 * - Roles are looked up with tenant context (falls back to global roles)
 * - Policies use path patterns for fine-grained resource control
 * - Services can use either scope-based or path-based enforcement
 */
export class AuthorizerService {
    private jwtService: JwtService;
    private policyRepository: PolicyRepository;
    private cacheWarmed: boolean = false;

    constructor() {
        this.jwtService = new JwtService();
        this.policyRepository = new PolicyRepository();
    }

    async authorize(event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
        try {
            // 1. Warm cache on cold start
            if (!this.cacheWarmed) {
                await this.policyRepository.warmCache();
                this.cacheWarmed = true;
            }

            // 2. Extract and verify JWT
            const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
            const token = this.jwtService.extractToken(authHeader);
            const payload = this.jwtService.verify(token);

            console.log('[Authorizer] JWT verified:', {
                userId: payload.sub,
                tenantId: payload.tenantId,
                roles: payload.roles,
                principalType: payload.principalType,
            });

            // 3. Resolve roles to scopes and policy (tenant-scoped with fallback)
            const { scopes, policy } = await this.policyRepository.resolvePolicies(
                payload.roles,
                payload.tenantId
            );

            console.log('[Authorizer] Policy resolved:', {
                userId: payload.sub,
                tenantId: payload.tenantId,
                scopeCount: scopes.length,
                statementCount: policy.statements?.length || 0,
            });

            // 4. Generate Allow policy with scopes and policy in context
            return this.generatePolicy(payload.sub, 'Allow', event.methodArn, payload, scopes, policy);

        } catch (error) {
            console.error('[Authorizer] Authorization error:', error);

            // Return Deny for any errors (invalid token, etc.)
            return this.generatePolicy('anonymous', 'Deny', event.methodArn);
        }
    }

    /**
     * Generates an IAM policy document for API Gateway
     */
    private generatePolicy(
        principalId: string,
        effect: 'Allow' | 'Deny',
        resource: string,
        jwtPayload?: JwtPayload,
        scopes?: string[],
        policy?: RolePolicy
    ): APIGatewayAuthorizerResult {
        const policyDocument: PolicyDocument = {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    // Allow all resources for this API so the policy can be cached
                    Resource: this.getWildcardResource(resource),
                } as PolicyStatement,
            ],
        };

        const context: AuthorizerContext | undefined = jwtPayload
            ? {
                userId: jwtPayload.sub,
                email: jwtPayload.email || '',
                roles: JSON.stringify(jwtPayload.roles),
                scopes: JSON.stringify(scopes || []),
                tenantId: jwtPayload.tenantId || '',
                principalType: jwtPayload.principalType || 'user',
                policy: policy ? JSON.stringify(policy) : undefined,
            }
            : undefined;

        return {
            principalId,
            policyDocument,
            context,
        };
    }

    /**
     * Convert specific methodArn to wildcard for policy caching
     * This allows API Gateway to cache the authorizer response
     */
    private getWildcardResource(methodArn: string): string {
        // Format: arn:aws:execute-api:region:account:api-id/stage/METHOD/path
        const parts = methodArn.split('/');
        if (parts.length >= 2) {
            // Keep arn and stage, wildcard the rest
            return `${parts[0]}/${parts[1]}/*`;
        }
        return methodArn;
    }
}
