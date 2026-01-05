import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewayAuthorizerResult,
    PolicyDocument,
    Statement as PolicyStatement
} from 'aws-lambda';
import { JwtService } from './jwt-service';
import { PolicyRepository } from './policy-repository';
import { AuthorizerContext, JwtPayload } from './types';

/**
 * Authorizer service that validates JWTs and resolves role-based permissions
 * 
 * Flow:
 * 1. Extract and verify JWT from Authorization header
 * 2. Resolve roles to scopes using in-memory cache (DynamoDB-backed)
 * 3. Return IAM policy with scopes in context for downstream services
 * 
 * Services trust the authorizer and enforce permissions using:
 * - requireScope(scopes, 'contract:read')
 * - hasScope(scopes, 'payment:*')
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

            // 3. Resolve roles to scopes (cached)
            const scopes = await this.policyRepository.resolveScopes(payload.roles);

            console.log('[Authorizer] Scopes resolved:', {
                userId: payload.sub,
                scopes,
            });

            // 4. Generate Allow policy with scopes in context
            // Services will enforce specific scope requirements
            return this.generatePolicy(payload.sub, 'Allow', event.methodArn, payload, scopes);

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
        scopes?: string[]
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
