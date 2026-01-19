import {
    APIGatewayRequestAuthorizerEvent,
} from 'aws-lambda';
import { JwtService } from './jwt-service';
import { PolicyRepository } from './policy-repository';
import { AuthorizerContext, JwtPayload, RolePolicy } from './types';

/**
 * Simple authorizer response for HTTP API
 * Used with enableSimpleResponses: true
 */
export interface SimpleAuthorizerResult {
    isAuthorized: boolean;
    context?: AuthorizerContext;
}

/**
 * Authorizer service that validates JWTs and resolves role-based permissions
 * 
 * Flow:
 * 1. Extract and verify JWT from Authorization header
 * 2. Resolve roles to policies using in-memory cache (DynamoDB-backed)
 * 3. Return simple response with policy in context for downstream services
 * 
 * Tenant-scoped authorization:
 * - Roles are looked up with tenant context (falls back to global roles)
 * - Policies use path patterns for fine-grained resource control
 */
export class AuthorizerService {
    private jwtService: JwtService;
    private policyRepository: PolicyRepository;
    private cacheWarmed: boolean = false;

    constructor() {
        this.jwtService = JwtService.getInstance();
        this.policyRepository = new PolicyRepository();
    }

    async authorize(event: APIGatewayRequestAuthorizerEvent): Promise<SimpleAuthorizerResult> {
        try {
            // 1. Warm cache on cold start
            if (!this.cacheWarmed) {
                await this.policyRepository.warmCache();
                this.cacheWarmed = true;
            }

            // 2. Extract and verify JWT
            const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
            const token = this.jwtService.extractToken(authHeader);
            const payload = await this.jwtService.verify(token);

            console.log('[Authorizer] JWT verified:', {
                userId: payload.sub,
                tenantId: payload.tenantId,
                roles: payload.roles,
                principalType: payload.principalType,
            });

            // 3. Resolve roles to policy (tenant-scoped with fallback)
            const policy = await this.policyRepository.resolvePolicies(
                payload.roles,
                payload.tenantId
            );

            console.log('[Authorizer] Policy resolved:', {
                userId: payload.sub,
                tenantId: payload.tenantId,
                statementCount: policy.statements?.length || 0,
            });

            // 4. Return simple authorized response with context
            return this.generateSimpleResponse(true, payload, policy);

        } catch (error) {
            console.error('[Authorizer] Authorization error:', error);

            // Return unauthorized for any errors (invalid token, etc.)
            return this.generateSimpleResponse(false);
        }
    }

    /**
     * Generates a simple authorizer response for HTTP API
     */
    private generateSimpleResponse(
        isAuthorized: boolean,
        jwtPayload?: JwtPayload,
        policy?: RolePolicy
    ): SimpleAuthorizerResult {
        if (!isAuthorized || !jwtPayload) {
            return { isAuthorized: false };
        }

        const context: AuthorizerContext = {
            userId: jwtPayload.sub,
            email: jwtPayload.email || '',
            roles: JSON.stringify(jwtPayload.roles),
            tenantId: jwtPayload.tenantId || '',
            principalType: jwtPayload.principalType || 'user',
            policy: policy ? JSON.stringify(policy) : undefined,
        };

        return {
            isAuthorized: true,
            context,
        };
    }
}
