/**
 * Authorizer Service Sanity Tests (AWS Staging)
 *
 * These tests validate the Lambda authorizer directly via AWS Lambda invoke.
 * They serve as sanity checks to ensure the authorizer is functioning correctly.
 *
 * Tests cover:
 * 1. Invalid/missing JWT returns Deny
 * 2. Valid JWT returns Allow with proper context
 * 3. Expired JWT returns Deny
 * 4. Cold start performance benchmarking
 *
 * Prerequisites:
 * - Authorizer Lambda deployed to AWS staging
 * - Valid AWS credentials configured
 *
 * Run with:
 *   npm run test:authorizer
 *   # or directly:
 *   ./scripts/run-authorizer-tests.sh
 */

import {
    LambdaClient,
    InvokeCommand,
    InvocationType,
} from '@aws-sdk/client-lambda';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// Lambda function name
const AUTHORIZER_FUNCTION_NAME =
    process.env.AUTHORIZER_FUNCTION_NAME || 'qshelter-authorizer-staging';

// JWT secret for test token generation (must match authorizer's secret)
const JWT_SECRET = process.env.JWT_SECRET || '';

// AWS region
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Lambda client
const lambdaClient = new LambdaClient({ region: AWS_REGION });

/**
 * Create an API Gateway HTTP API v2.0 REQUEST authorizer event
 */
function createAuthorizerEvent(authHeader: string): object {
    return {
        version: '2.0',
        type: 'REQUEST',
        routeArn:
            'arn:aws:execute-api:us-east-1:123456789012:api-id/staging/$default',
        identitySource: [authHeader],
        routeKey: '$default',
        rawPath: '/users',
        rawQueryString: '',
        headers: {
            Authorization: authHeader,
            'content-type': 'application/json',
            host: 'api.example.com',
        },
        requestContext: {
            accountId: '123456789012',
            apiId: 'api-id',
            domainName: 'api.example.com',
            domainPrefix: 'api',
            http: {
                method: 'GET',
                path: '/users',
                protocol: 'HTTP/1.1',
                sourceIp: '127.0.0.1',
                userAgent: 'test-agent',
            },
            requestId: randomUUID(),
            routeKey: '$default',
            stage: 'staging',
            time: new Date().toISOString(),
            timeEpoch: Date.now(),
        },
    };
}

/**
 * Invoke the authorizer Lambda directly
 */
async function invokeAuthorizer(event: object): Promise<{
    statusCode: number;
    payload: {
        isAuthorized?: boolean;
        context?: Record<string, string>;
    };
    duration: number;
}> {
    const startTime = Date.now();

    const command = new InvokeCommand({
        FunctionName: AUTHORIZER_FUNCTION_NAME,
        InvocationType: InvocationType.RequestResponse,
        Payload: Buffer.from(JSON.stringify(event)),
    });

    const response = await lambdaClient.send(command);
    const duration = Date.now() - startTime;

    const payloadString = Buffer.from(response.Payload!).toString('utf-8');
    const payload = JSON.parse(payloadString);

    return {
        statusCode: response.StatusCode!,
        payload,
        duration,
    };
}

/**
 * Generate a test JWT token
 */
function generateTestToken(
    payload: {
        sub: string;
        email?: string;
        roles?: string[];
        tenantId?: string;
        principalType?: string;
    },
    options?: { expiresIn?: number }
): string {
    if (!JWT_SECRET) {
        throw new Error(
            'JWT_SECRET is required for generating test tokens. Set it via environment variable.'
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + (options?.expiresIn ?? 3600); // Default 1 hour

    return jwt.sign(
        {
            ...payload,
            iat: now,
            exp,
        },
        JWT_SECRET
    );
}

describe('Authorizer Service Sanity Tests', () => {
    describe('Invalid Token Handling', () => {
        it('should return unauthorized for missing Authorization header', async () => {
            const event = createAuthorizerEvent('');

            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.payload.isAuthorized).toBe(false);

            console.log(`  ⏱  Response time: ${result.duration}ms`);
        });

        it('should return unauthorized for invalid JWT format', async () => {
            const event = createAuthorizerEvent('Bearer invalid-jwt-token');

            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.payload.isAuthorized).toBe(false);

            console.log(`  ⏱  Response time: ${result.duration}ms`);
        });

        it('should return unauthorized for malformed Authorization header', async () => {
            const event = createAuthorizerEvent('NotBearer some-token');

            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.payload.isAuthorized).toBe(false);

            console.log(`  ⏱  Response time: ${result.duration}ms`);
        });
    });

    describe('Valid Token Handling', () => {
        // Skip if no JWT_SECRET provided
        const conditionalDescribe = JWT_SECRET ? describe : describe.skip;

        conditionalDescribe('with JWT_SECRET configured', () => {
            it('should return authorized for valid JWT with roles', async () => {
                const userId = randomUUID();
                const tenantId = randomUUID();
                const token = generateTestToken({
                    sub: userId,
                    email: 'test@example.com',
                    roles: ['admin'],
                    tenantId,
                    principalType: 'user',
                });

                const event = createAuthorizerEvent(`Bearer ${token}`);

                const result = await invokeAuthorizer(event);

                expect(result.statusCode).toBe(200);
                expect(result.payload.isAuthorized).toBe(true);
                expect(result.payload.context?.userId).toBe(userId);
                expect(result.payload.context?.tenantId).toBe(tenantId);
                expect(result.payload.context?.roles).toBe(
                    JSON.stringify(['admin'])
                );

                console.log(`  ⏱  Response time: ${result.duration}ms`);
            });

            it('should return unauthorized for expired JWT', async () => {
                const token = generateTestToken(
                    {
                        sub: randomUUID(),
                        email: 'test@example.com',
                        roles: ['admin'],
                        tenantId: randomUUID(),
                    },
                    { expiresIn: -3600 } // Already expired (1 hour ago)
                );

                const event = createAuthorizerEvent(`Bearer ${token}`);

                const result = await invokeAuthorizer(event);

                expect(result.statusCode).toBe(200);
                expect(result.payload.isAuthorized).toBe(false);

                console.log(`  ⏱  Response time: ${result.duration}ms`);
            });

            it('should handle multiple roles in JWT', async () => {
                const userId = randomUUID();
                const tenantId = randomUUID();
                const roles = ['admin', 'property_manager', 'mortgage_officer'];
                const token = generateTestToken({
                    sub: userId,
                    email: 'multi-role@example.com',
                    roles,
                    tenantId,
                    principalType: 'user',
                });

                const event = createAuthorizerEvent(`Bearer ${token}`);

                const result = await invokeAuthorizer(event);

                expect(result.statusCode).toBe(200);
                expect(result.payload.isAuthorized).toBe(true);
                expect(result.payload.context?.roles).toBe(
                    JSON.stringify(roles)
                );

                console.log(`  ⏱  Response time: ${result.duration}ms`);
            });
        });
    });

    describe('Performance Benchmarking', () => {
        it('should respond under 5 seconds for cold start', async () => {
            // This test assumes a cold start. In practice, you may need to
            // update the function or wait for the container to be recycled.
            const event = createAuthorizerEvent('Bearer invalid-token');

            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.duration).toBeLessThan(5000); // 5 second max for cold start

            console.log(`  ⏱  Cold start response time: ${result.duration}ms`);
        });

        it('should respond under 500ms for warm invocation', async () => {
            // First call to warm up
            const warmupEvent = createAuthorizerEvent('Bearer warmup-token');
            await invokeAuthorizer(warmupEvent);

            // Second call should be faster
            const event = createAuthorizerEvent('Bearer test-token');
            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.duration).toBeLessThan(500); // 500ms max for warm invocation

            console.log(`  ⏱  Warm invocation response time: ${result.duration}ms`);
        });

        it('should benchmark 10 consecutive invocations', async () => {
            const durations: number[] = [];

            for (let i = 0; i < 10; i++) {
                const event = createAuthorizerEvent(`Bearer test-token-${i}`);
                const result = await invokeAuthorizer(event);
                durations.push(result.duration);
            }

            const avgDuration =
                durations.reduce((a, b) => a + b, 0) / durations.length;
            const minDuration = Math.min(...durations);
            const maxDuration = Math.max(...durations);
            const p95Index = Math.floor(durations.length * 0.95);
            const sortedDurations = [...durations].sort((a, b) => a - b);
            const p95Duration = sortedDurations[p95Index];

            console.log(`\n  📊 Benchmark Results (10 invocations):`);
            console.log(`     Average: ${avgDuration.toFixed(2)}ms`);
            console.log(`     Min:     ${minDuration}ms`);
            console.log(`     Max:     ${maxDuration}ms`);
            console.log(`     P95:     ${p95Duration}ms`);

            // Assert reasonable performance
            expect(avgDuration).toBeLessThan(1000); // Average under 1 second
        });
    });
});
