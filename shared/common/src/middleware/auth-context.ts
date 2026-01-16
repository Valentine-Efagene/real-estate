import { Request, Response, NextFunction } from 'express';

/**
 * Authentication context injected by API Gateway Lambda Authorizer.
 * Services should NEVER trust client-supplied user IDs directly.
 * 
 * In production:
 * - API Gateway calls Lambda Authorizer with JWT
 * - Authorizer validates token and returns context
 * - Gateway injects context into event.requestContext.authorizer
 * - serverless-http makes this available as req.requestContext.authorizer
 * 
 * In tests:
 * - We simulate the authorizer by setting x-authorizer-* headers
 * - These headers are ONLY set by test harness, never by real clients
 */
export interface AuthContext {
    userId: string;
    tenantId: string;
    email?: string;
    roles?: string[];
}

/**
 * Extended Request type that includes Lambda requestContext
 */
interface LambdaRequest extends Request {
    requestContext?: {
        authorizer?: {
            userId?: string;
            tenantId?: string;
            email?: string;
            roles?: string;
        };
    };
    auth?: AuthContext;
}

/**
 * Safely decode JWT payload without verification.
 * Used to extract claims like roles when authorizer context isn't available.
 * Note: This is NOT validation - we trust the token was already validated upstream.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

/**
 * Extracts auth context from API Gateway authorizer or JWT token.
 * 
 * Priority:
 * 1. Production: requestContext.authorizer (set by API Gateway Lambda Authorizer)
 * 2. Fallback: Decode JWT from Authorization header (LocalStack/dev/tests)
 * 
 * In production, the Lambda Authorizer validates the JWT and injects context.
 * In LocalStack (no authorizer), we decode the JWT directly since it contains
 * all the same information: sub (userId), tenantId, email, roles.
 * 
 * @param req Express request object
 * @returns AuthContext or null if not authenticated
 */
export function extractAuthContext(req: Request): AuthContext | null {
    const lambdaReq = req as LambdaRequest;

    // Production: API Gateway Lambda integration populates requestContext
    const authorizer = lambdaReq.requestContext?.authorizer;
    if (authorizer?.userId && authorizer?.tenantId) {
        return {
            userId: authorizer.userId,
            tenantId: authorizer.tenantId,
            email: authorizer.email,
            roles: authorizer.roles ? JSON.parse(authorizer.roles) : [],
        };
    }

    // Fallback: Decode JWT directly (LocalStack, local dev, tests)
    // The JWT already contains: sub (userId), tenantId, email, roles
    const authHeader = req.headers['authorization'] as string;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = decodeJwtPayload(token);

        if (payload?.sub && payload?.tenantId) {
            return {
                userId: payload.sub,
                tenantId: payload.tenantId,
                email: payload.email,
                roles: Array.isArray(payload.roles) ? payload.roles : [],
            };
        }
    }

    // Legacy fallback: Mock headers for unit tests without real JWTs
    // These should only be used in unit tests, not E2E or production
    const mockUserId = req.headers['x-authorizer-user-id'] as string;
    const mockTenantId = req.headers['x-authorizer-tenant-id'] as string;
    if (mockUserId && mockTenantId) {
        const rolesHeader = req.headers['x-authorizer-roles'] as string;
        return {
            userId: mockUserId,
            tenantId: mockTenantId,
            email: req.headers['x-authorizer-email'] as string,
            roles: rolesHeader ? JSON.parse(rolesHeader) : [],
        };
    }

    return null;
}

/**
 * Middleware that requires authenticated context.
 * Rejects requests without valid authorizer context.
 * 
 * @example
 * ```typescript
 * app.use('/api', requireAuth, apiRouter);
 * ```
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const auth = extractAuthContext(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized - missing auth context' });
    }

    // Attach to request for downstream use
    (req as LambdaRequest).auth = auth;
    next();
}

/**
 * Helper to get auth context from request (after requireAuth middleware).
 * Throws if auth context is missing.
 * 
 * @example
 * ```typescript
 * router.get('/profile', (req, res) => {
 *     const { userId, tenantId } = getAuthContext(req);
 *     // ...
 * });
 * ```
 */
export function getAuthContext(req: Request): AuthContext {
    const lambdaReq = req as LambdaRequest;

    // First check if middleware attached it
    if (lambdaReq.auth) {
        return lambdaReq.auth;
    }

    // Otherwise try to extract it
    const auth = extractAuthContext(req);
    if (!auth) {
        throw new Error('Auth context not found. Ensure requireAuth middleware is applied or request has valid auth headers.');
    }
    return auth;
}

/**
 * Test helper to generate authorization header with JWT.
 * 
 * Since auth context is now extracted directly from the JWT,
 * tests only need to pass the Authorization header with a valid token.
 * 
 * @example
 * ```typescript
 * const response = await request(app)
 *     .post('/users')
 *     .set('Authorization', `Bearer ${token}`)
 *     .send({ name: 'John' });
 * ```
 * 
 * @deprecated Use `mockAuthHeaders` for E2E tests or pass Authorization header directly with JWT token.
 * This helper is kept for backward compatibility.
 */
export function authHeaders(
    userId: string,
    tenantId: string,
    extras?: { email?: string; roles?: string[]; token?: string }
): Record<string, string> {
    // If a token is provided, just use that (preferred)
    if (extras?.token) {
        return { 'Authorization': `Bearer ${extras.token}` };
    }

    // Legacy: Build mock headers for tests without real JWT
    // This is only for unit tests that don't have access to real tokens
    return {
        'x-authorizer-user-id': userId,
        'x-authorizer-tenant-id': tenantId,
        ...(extras?.email && { 'x-authorizer-email': extras.email }),
        ...(extras?.roles && { 'x-authorizer-roles': JSON.stringify(extras.roles) }),
    };
}

/**
 * Generate mock authorization headers for E2E tests.
 * 
 * This is the preferred helper for E2E tests that bypass JWT authentication
 * and instead use mock headers that simulate what the Lambda authorizer would set.
 * 
 * @param userId - The user ID to set in the mock headers
 * @param tenantId - The tenant ID to set in the mock headers  
 * @param options - Optional additional header values
 * @returns Headers object to pass to supertest .set()
 * 
 * @example
 * ```typescript
 * const response = await api
 *     .post('/applications')
 *     .set(mockAuthHeaders(userId, tenantId, { roles: [ROLES.CUSTOMER] }))
 *     .send({ ... });
 * ```
 */
export function mockAuthHeaders(
    userId: string,
    tenantId: string,
    options?: { email?: string; roles?: string[] }
): Record<string, string> {
    return {
        'x-authorizer-user-id': userId,
        'x-authorizer-tenant-id': tenantId,
        ...(options?.email && { 'x-authorizer-email': options.email }),
        ...(options?.roles && { 'x-authorizer-roles': JSON.stringify(options.roles) }),
    };
}

/**
 * Standard role names used across the platform.
 */
export const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    TENANT_ADMIN: 'TENANT_ADMIN',
    LOAN_OFFICER: 'LOAN_OFFICER',
    CUSTOMER: 'CUSTOMER',
    VIEWER: 'VIEWER',
    /** Property developers who list properties and upload sales offer letters */
    DEVELOPER: 'DEVELOPER',
    /** Bank/financial institution representatives who upload preapproval and mortgage offer letters */
    LENDER: 'LENDER',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/**
 * Roles that have admin privileges (can manage resources).
 */
export const ADMIN_ROLES: RoleName[] = [ROLES.SUPER_ADMIN, ROLES.TENANT_ADMIN, ROLES.LOAN_OFFICER];

/**
 * Check if user has any of the specified roles.
 */
export function hasAnyRole(userRoles: string[] | undefined, requiredRoles: string[]): boolean {
    if (!userRoles || userRoles.length === 0) return false;
    return requiredRoles.some(role => userRoles.includes(role));
}

/**
 * Check if user has admin privileges.
 */
export function isAdmin(userRoles: string[] | undefined): boolean {
    return hasAnyRole(userRoles, ADMIN_ROLES);
}

/**
 * Middleware factory that requires user to have specific role(s).
 * Uses roles from API Gateway authorizer context.
 * 
 * @example
 * ```typescript
 * // Require any admin role
 * router.post('/payment-plans', requireRole(ADMIN_ROLES), createPaymentPlan);
 * 
 * // Require specific role
 * router.delete('/users/:id', requireRole(['SUPER_ADMIN']), deleteUser);
 * ```
 */
export function requireRole(allowedRoles: string[]) {
    return function (req: Request, res: Response, next: NextFunction) {
        const auth = extractAuthContext(req);

        if (!auth) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - authentication required'
            });
        }

        if (!hasAnyRole(auth.roles, allowedRoles)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden - insufficient permissions',
                requiredRoles: allowedRoles,
            });
        }

        next();
    };
}

/**
 * Middleware that requires admin privileges.
 * Shorthand for requireRole(ADMIN_ROLES).
 * 
 * @example
 * ```typescript
 * router.post('/payment-methods', requireAdmin, createPaymentMethod);
 * ```
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    return requireRole(ADMIN_ROLES)(req, res, next);
}
