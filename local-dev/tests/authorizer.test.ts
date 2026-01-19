/**
 * Authorizer Service LocalStack Tests
 *
 * These tests validate the Lambda authorizer against LocalStack deployment.
 * Used for benchmarking and performance analysis during local development.
 *
 * Tests cover:
 * 1. Invalid/missing JWT returns Deny
 * 2. Valid JWT returns Allow with proper context
 * 3. Policy resolution from DynamoDB
 * 4. Cold start and warm invocation performance
 *
 * Prerequisites:
 * - LocalStack running (docker-compose up -d)
 * - Authorizer service deployed to LocalStack
 * - DynamoDB table with role policies seeded
 *
 * Run with:
 *   cd local-dev
 *   pnpm run test:authorizer
 */

import { InvokeCommand, InvocationType } from '@aws-sdk/client-lambda';
import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createLambdaClient, createDynamoDBClient } from '../lib/aws-clients';

// LocalStack Lambda function name
const AUTHORIZER_FUNCTION_NAME =
    process.env.AUTHORIZER_FUNCTION_NAME || 'qshelter-authorizer-dev-authorizer';

// DynamoDB table for role policies
const ROLE_POLICIES_TABLE =
    process.env.ROLE_POLICIES_TABLE || 'qshelter-dev-role-policies';

// JWT secret for test token generation (must match LocalStack authorizer config)
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'local-test-jwt-secret';

// Clients
const lambdaClient = createLambdaClient();
const dynamoClient = createDynamoDBClient();

/**
 * Create an API Gateway HTTP API v2.0 REQUEST authorizer event
 */
function createAuthorizerEvent(
    authHeader: string,
    path: string = '/users',
    method: string = 'GET'
): object {
    return {
        version: '2.0',
        type: 'REQUEST',
        routeArn: `arn:aws:execute-api:us-east-1:000000000000:localstack-api/dev/${method}${path}`,
        identitySource: [authHeader],
        routeKey: '$default',
        rawPath: path,
        rawQueryString: '',
        headers: {
            Authorization: authHeader,
            'content-type': 'application/json',
            host: 'localhost:4566',
        },
        requestContext: {
            accountId: '000000000000',
            apiId: 'localstack-api',
            domainName: 'localhost',
            domainPrefix: 'localhost',
            http: {
                method,
                path,
                protocol: 'HTTP/1.1',
                sourceIp: '127.0.0.1',
                userAgent: 'localstack-test',
            },
            requestId: randomUUID(),
            routeKey: '$default',
            stage: 'dev',
            time: new Date().toISOString(),
            timeEpoch: Date.now(),
        },
    };
}

/**
 * Invoke the authorizer Lambda
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
    let payload;
    try {
        payload = JSON.parse(payloadString);
    } catch {
        console.error('Failed to parse Lambda response:', payloadString);
        throw new Error(`Invalid Lambda response: ${payloadString}`);
    }

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

/**
 * Seed a role policy in DynamoDB for testing
 */
async function seedRolePolicy(
    roleName: string,
    tenantId: string,
    statements: Array<{
        effect: 'Allow' | 'Deny';
        resources: Array<{ path: string; methods: string[] }>;
    }>
): Promise<void> {
    const pk = `TENANT#${tenantId}#ROLE#${roleName}`;
    const now = new Date().toISOString();

    await dynamoClient.send(
        new PutItemCommand({
            TableName: ROLE_POLICIES_TABLE,
            Item: {
                PK: { S: pk },
                SK: { S: 'POLICY' },
                roleName: { S: roleName },
                tenantId: { S: tenantId },
                isActive: { BOOL: true },
                policy: {
                    M: {
                        version: { S: '2.0' },
                        statements: {
                            L: statements.map((stmt) => ({
                                M: {
                                    effect: { S: stmt.effect },
                                    resources: {
                                        L: stmt.resources.map((res) => ({
                                            M: {
                                                path: { S: res.path },
                                                methods: {
                                                    L: res.methods.map((m) => ({ S: m })),
                                                },
                                            },
                                        })),
                                    },
                                },
                            })),
                        },
                    },
                },
                GSI1PK: { S: `TENANT#${tenantId}` },
                GSI1SK: { S: `ROLE#${roleName}` },
                updatedAt: { S: now },
            },
        })
    );
}

describe('Authorizer Service LocalStack Tests', () => {
    const testTenantId = randomUUID();
    const testUserId = randomUUID();

    beforeAll(async () => {
        // Seed a test role policy for valid token tests
        await seedRolePolicy('test-admin', testTenantId, [
            {
                effect: 'Allow',
                resources: [
                    { path: '/users/*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
                    { path: '/properties/*', methods: ['GET', 'POST'] },
                ],
            },
        ]);

        console.log(`Seeded test policy for tenant: ${testTenantId}`);
    });

    describe('Invalid Token Handling', () => {
        it('should return Deny for missing Authorization header', async () => {
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

        it('should return unauthorized for expired JWT', async () => {
            const token = generateTestToken(
                {
                    sub: testUserId,
                    email: 'expired@test.com',
                    roles: ['test-admin'],
                    tenantId: testTenantId,
                },
                { expiresIn: -3600 } // Already expired (1 hour ago)
            );

            const event = createAuthorizerEvent(`Bearer ${token}`);

            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.payload.isAuthorized).toBe(false);

            console.log(`  ⏱  Response time: ${result.duration}ms`);
        });
    });

    describe('Valid Token Handling', () => {
        it('should return authorized for valid JWT with roles', async () => {
            const token = generateTestToken({
                sub: testUserId,
                email: 'test@example.com',
                roles: ['test-admin'],
                tenantId: testTenantId,
                principalType: 'user',
            });

            const event = createAuthorizerEvent(`Bearer ${token}`);

            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.payload.isAuthorized).toBe(true);
            expect(result.payload.context?.userId).toBe(testUserId);
            expect(result.payload.context?.tenantId).toBe(testTenantId);

            console.log(`  ⏱  Response time: ${result.duration}ms`);
        });

        it('should include policy in context for downstream services', async () => {
            const token = generateTestToken({
                sub: testUserId,
                email: 'test@example.com',
                roles: ['test-admin'],
                tenantId: testTenantId,
            });

            const event = createAuthorizerEvent(`Bearer ${token}`);

            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.payload.context?.policy).toBeDefined();

            // Parse and verify policy structure
            const policy = JSON.parse(result.payload.context!.policy!);
            expect(policy.version).toBe('2.0');
            expect(policy.statements).toBeInstanceOf(Array);
            expect(policy.statements.length).toBeGreaterThan(0);

            console.log(`  ⏱  Response time: ${result.duration}ms`);
        });
    });

    describe('Performance Benchmarking', () => {
        it('should respond under 2 seconds for cold start (LocalStack)', async () => {
            const event = createAuthorizerEvent('Bearer cold-start-test');

            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            // LocalStack is slower than real Lambda, allow up to 2 seconds
            expect(result.duration).toBeLessThan(2000);

            console.log(`  ⏱  Cold start response time: ${result.duration}ms`);
        });

        it('should respond under 500ms for warm invocation', async () => {
            // Warmup call
            await invokeAuthorizer(createAuthorizerEvent('Bearer warmup'));

            // Actual test
            const event = createAuthorizerEvent('Bearer warm-test');
            const result = await invokeAuthorizer(event);

            expect(result.statusCode).toBe(200);
            expect(result.duration).toBeLessThan(500);

            console.log(`  ⏱  Warm invocation response time: ${result.duration}ms`);
        });

        it('should benchmark 10 consecutive invocations', async () => {
            const durations: number[] = [];

            // Warmup
            await invokeAuthorizer(createAuthorizerEvent('Bearer warmup'));

            for (let i = 0; i < 10; i++) {
                const token = generateTestToken({
                    sub: testUserId,
                    email: 'benchmark@test.com',
                    roles: ['test-admin'],
                    tenantId: testTenantId,
                });
                const event = createAuthorizerEvent(`Bearer ${token}`);
                const result = await invokeAuthorizer(event);
                durations.push(result.duration);
            }

            const avgDuration =
                durations.reduce((a, b) => a + b, 0) / durations.length;
            const minDuration = Math.min(...durations);
            const maxDuration = Math.max(...durations);
            const sortedDurations = [...durations].sort((a, b) => a - b);
            const p95Duration = sortedDurations[Math.floor(durations.length * 0.95)];

            console.log(`\n  📊 Benchmark Results (10 invocations):`);
            console.log(`     Average: ${avgDuration.toFixed(2)}ms`);
            console.log(`     Min:     ${minDuration}ms`);
            console.log(`     Max:     ${maxDuration}ms`);
            console.log(`     P95:     ${p95Duration}ms`);

            // LocalStack is slower, allow up to 1 second average
            expect(avgDuration).toBeLessThan(1000);
        });

        it('should handle concurrent requests', async () => {
            const concurrency = 5;
            const requests = Array.from({ length: concurrency }, (_, i) => {
                const token = generateTestToken({
                    sub: `user-${i}`,
                    email: `concurrent-${i}@test.com`,
                    roles: ['test-admin'],
                    tenantId: testTenantId,
                });
                return invokeAuthorizer(
                    createAuthorizerEvent(`Bearer ${token}`)
                );
            });

            const startTime = Date.now();
            const results = await Promise.all(requests);
            const totalTime = Date.now() - startTime;

            // All should succeed
            results.forEach((result, i) => {
                expect(result.statusCode).toBe(200);
                expect(result.payload.isAuthorized).toBe(true);
            });

            console.log(
                `  ⏱  ${concurrency} concurrent requests completed in ${totalTime}ms`
            );
            console.log(
                `     Average per request: ${(totalTime / concurrency).toFixed(2)}ms`
            );
        });
    });
});
