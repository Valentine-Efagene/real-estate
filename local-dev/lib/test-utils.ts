/**
 * E2E Test Utilities
 *
 * Shared utilities for e2e tests across all services.
 * Provides test JWT generation, database cleanup, and AWS mocking helpers.
 */

import jwt, { type SignOptions } from 'jsonwebtoken';

/**
 * JWT payload for test tokens
 */
export interface TestJwtPayload {
    sub: string;
    email: string;
    roles: string[];
    tenantId?: number;
    firstName?: string;
    lastName?: string;
}

/**
 * Generate a test JWT token
 *
 * @param payload - The JWT payload
 * @param options - Optional JWT sign options
 * @returns The signed JWT token
 */
export function generateTestJwt(
    payload: TestJwtPayload,
    options?: {
        expiresIn?: string;
        secret?: string;
    }
): string {
    const secret =
        options?.secret ||
        process.env.JWT_ACCESS_SECRET ||
        'test-jwt-access-secret-key-for-e2e-testing-min-32-chars';

    const signOptions: SignOptions = {
        expiresIn: (options?.expiresIn || '1h') as jwt.SignOptions['expiresIn'],
    };

    return jwt.sign(
        {
            ...payload,
            iat: Math.floor(Date.now() / 1000),
        },
        secret,
        signOptions
    );
}

/**
 * Pre-built test users for e2e tests
 */
export const testUsers = {
    admin: {
        sub: 'test-admin-user-id',
        email: 'admin@test.qshelter.com',
        roles: ['admin'],
        tenantId: 1,
        firstName: 'Test',
        lastName: 'Admin',
    },
    buyer: {
        sub: 'test-buyer-user-id',
        email: 'buyer@test.qshelter.com',
        roles: ['buyer'],
        tenantId: 1,
        firstName: 'Test',
        lastName: 'Buyer',
    },
    agent: {
        sub: 'test-agent-user-id',
        email: 'agent@test.qshelter.com',
        roles: ['agent'],
        tenantId: 1,
        firstName: 'Test',
        lastName: 'Agent',
    },
    landlord: {
        sub: 'test-landlord-user-id',
        email: 'landlord@test.qshelter.com',
        roles: ['landlord'],
        tenantId: 1,
        firstName: 'Test',
        lastName: 'Landlord',
    },
};

/**
 * Get authorization header for a test user
 *
 * @param userType - The type of test user
 * @returns The Authorization header value
 */
export function getAuthHeader(
    userType: keyof typeof testUsers = 'admin'
): string {
    const token = generateTestJwt(testUsers[userType]);
    return `Bearer ${token}`;
}

/**
 * Create a custom test user and get their auth header
 *
 * @param payload - Custom JWT payload
 * @returns The Authorization header value
 */
export function getCustomAuthHeader(payload: TestJwtPayload): string {
    const token = generateTestJwt(payload);
    return `Bearer ${token}`;
}

/**
 * Parse the roles from an authorization header
 * (useful for debugging tests)
 */
export function parseAuthHeader(authHeader: string): TestJwtPayload | null {
    try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.decode(token) as TestJwtPayload;
        return decoded;
    } catch {
        return null;
    }
}

/**
 * Wait for a condition to be true (useful for async operations)
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in ms
 * @param interval - Check interval in ms
 */
export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random test ID
 */
export function randomTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format a date for database insertion
 */
export function toDbDate(date: Date = new Date()): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}
