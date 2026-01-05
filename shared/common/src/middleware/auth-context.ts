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
 * Extracts auth context from API Gateway authorizer.
 * 
 * Priority:
 * 1. Production: requestContext.authorizer (set by API Gateway)
 * 2. Test/Dev: x-authorizer-* headers (set by test harness)
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

    // Test/Development: Simulated authorizer headers
    // These headers should only be set by test harness or local dev proxy
    const userId = req.headers['x-authorizer-user-id'] as string;
    const tenantId = req.headers['x-authorizer-tenant-id'] as string;

    if (userId && tenantId) {
        const rolesHeader = req.headers['x-authorizer-roles'] as string;
        return {
            userId,
            tenantId,
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
 * Test helper to generate authorizer headers.
 * Use this in tests to simulate API Gateway authorizer context.
 * 
 * @example
 * ```typescript
 * const response = await request(app)
 *     .post('/users')
 *     .set(authHeaders(userId, tenantId))
 *     .send({ name: 'John' });
 * ```
 */
export function authHeaders(
    userId: string,
    tenantId: string,
    extras?: { email?: string; roles?: string[] }
): Record<string, string> {
    return {
        'x-authorizer-user-id': userId,
        'x-authorizer-tenant-id': tenantId,
        ...(extras?.email && { 'x-authorizer-email': extras.email }),
        ...(extras?.roles && { 'x-authorizer-roles': JSON.stringify(extras.roles) }),
    };
}
