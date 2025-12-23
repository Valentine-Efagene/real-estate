import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewayAuthorizerResult,
    PolicyDocument,
    Statement as PolicyStatement
} from 'aws-lambda';
import { JwtService } from './jwt-service';
import { PolicyRepository } from './policy-repository';
import { PathMatcher } from './path-matcher';
import { AuthorizerContext } from './types';

export class AuthorizerService {
    private jwtService: JwtService;
    private policyRepository: PolicyRepository;
    private pathMatcher: PathMatcher;

    constructor() {
        this.jwtService = new JwtService();
        this.policyRepository = new PolicyRepository();
        this.pathMatcher = new PathMatcher();
    }

    async authorize(event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
        try {
            // 1. Extract and verify JWT
            const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
            const token = this.jwtService.extractToken(authHeader);
            const payload = this.jwtService.verify(token);

            console.log('JWT verified for user:', payload.sub, 'roles:', payload.roles);

            // 2. Fetch policies for all user roles from DynamoDB
            const rolePolicies = await this.policyRepository.getPoliciesForRoles(payload.roles);

            if (rolePolicies.length === 0) {
                console.log('No active policies found for roles:', payload.roles);
                return this.generatePolicy(payload.sub, 'Deny', event.methodArn, payload);
            }

            // 3. Extract path and method from request event
            const path = event.resource; // e.g., /users/{id}
            const method = event.httpMethod; // e.g., GET, POST
            console.log('Checking access for:', method, path);

            // 4. Check if any role policy allows access
            let allowed = false;

            for (const rolePolicy of rolePolicies) {
                for (const statement of rolePolicy.policy.statements) {
                    if (statement.effect === 'Allow') {
                        const matches = this.pathMatcher.matchesAnyResource(
                            path,
                            method,
                            statement.resources
                        );

                        if (matches) {
                            console.log(`Access granted by role: ${rolePolicy.roleName}`);
                            allowed = true;
                            break;
                        }
                    }
                }

                if (allowed) break;
            }

            // 5. Generate IAM policy
            const effect = allowed ? 'Allow' : 'Deny';
            console.log(`Final decision: ${effect} for ${method} ${path}`);

            return this.generatePolicy(payload.sub, effect, event.methodArn, payload);

        } catch (error) {
            console.error('Authorization error:', error);

            // Return Deny for any errors (invalid token, etc.)
            return this.generatePolicy('user', 'Deny', event.methodArn);
        }
    }

    /**
     * Parses the methodArn to extract path and HTTP method
     * Example: arn:aws:execute-api:us-east-1:123456789:api-id/stage/GET/users/123
     */
    private parseMethodArn(methodArn: string): { path: string; method: string } {
        const parts = methodArn.split('/');

        // Format: arn:aws:execute-api:region:account:api-id/stage/METHOD/path/to/resource
        if (parts.length < 3) {
            return { path: '/', method: 'GET' };
        }

        const method = parts[2]; // GET, POST, etc.
        const pathParts = parts.slice(3); // Everything after METHOD
        const path = '/' + pathParts.join('/');

        return { path, method };
    }

    /**
     * Generates an IAM policy document for API Gateway
     */
    private generatePolicy(
        principalId: string,
        effect: 'Allow' | 'Deny',
        resource: string,
        jwtPayload?: { sub: string; email: string; roles: string[]; tenantId?: string }
    ): APIGatewayAuthorizerResult {
        const policyDocument: PolicyDocument = {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource,
                } as PolicyStatement,
            ],
        };

        const context: AuthorizerContext | undefined = jwtPayload
            ? {
                userId: jwtPayload.sub,
                email: jwtPayload.email,
                roles: JSON.stringify(jwtPayload.roles),
                tenantId: jwtPayload.tenantId || '',
            }
            : undefined;

        return {
            principalId,
            policyDocument,
            context,
        };
    }
}
