import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ConfigService } from '../config/config.service';

/**
 * Authentication context extracted from JWT tokens.
 * Services verify JWTs directly using the shared middleware —
 * no external Lambda authorizer or DynamoDB policy lookup needed.
 *
 * Priority:
 * 1. Verify JWT from Authorization header (all environments)
 * 2. Mock headers for unit tests (x-authorizer-* headers)
 */
export interface AuthContext {
    userId: string;
    tenantId: string;
    email?: string;
    roles?: string[];
}

interface AuthenticatedRequest extends Request {
    auth?: AuthContext;
}

// ── JWT verification configuration ──────────────────────────────────────────

let _jwtSecret: string | null = null;
let _authInitialized = false;

/**
 * Configure JWT verification for the auth middleware.
 * Must be called at service startup before handling requests.
 *
 * @example
 * ```typescript
 * import { configureAuth } from '@valentine-efagene/qshelter-common';
 *
 * configureAuth({ jwtSecret: 'my-secret' });
 * ```
 */
export function configureAuth(options: {
    /** The JWT access token secret for verification */
    jwtSecret: string;
}): void {
    _jwtSecret = options.jwtSecret;
    _authInitialized = true;
}

/**
 * Initialize auth from ConfigService (fetches JWT secret from AWS Secrets Manager).
 * Call once during Lambda cold start or server startup.
 *
 * @example
 * ```typescript
 * import { setupAuth } from '@valentine-efagene/qshelter-common';
 *
 * // In lambda.ts or server startup:
 * await setupAuth();
 * ```
 */
export async function setupAuth(stage?: string): Promise<void> {
    if (_authInitialized) return; // Already configured

    try {
        const configService = ConfigService.getInstance();
        const jwtSecrets = await configService.getJwtAccessSecret(stage);
        configureAuth({ jwtSecret: jwtSecrets.secret });
        console.log('[auth] JWT verification configured from ConfigService');
    } catch (error: any) {
        console.warn(`[auth] Failed to fetch JWT secret from ConfigService: ${error.message}. JWT verification will use decode-only fallback.`);
    }
}

/**
 * Safely decode JWT payload without verification.
 * Used as fallback when jwtVerify is not configured (dev/tests).
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
 * Extracts and verifies auth context from the JWT in the Authorization header.
 *
 * Priority:
 * 1. Verify JWT signature using configured secret (production & local)
 * 2. Decode JWT without verification (fallback when secret not configured)
 * 3. Mock headers for unit tests (x-authorizer-* headers)
 *
 * @param req Express request object
 * @returns AuthContext or null if not authenticated
 */
export function extractAuthContext(req: Request): AuthContext | null {
    // Method 1: JWT from Authorization header
    const authHeader = req.headers['authorization'] as string;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // If secret is configured, verify the token signature
        if (_jwtSecret) {
            try {
                const payload = jwt.verify(token, _jwtSecret) as any;
                if (payload?.sub && payload?.tenantId) {
                    return {
                        userId: payload.sub,
                        tenantId: payload.tenantId,
                        email: payload.email,
                        roles: Array.isArray(payload.roles) ? payload.roles : [],
                    };
                }
            } catch {
                // JWT verification failed — invalid/expired token
                return null;
            }
        } else {
            // Fallback: decode without verification (dev mode, no secret configured)
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
    }

    // Method 2: Mock headers for unit tests without real JWTs
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
 * Rejects requests without valid auth context (invalid/missing JWT).
 *
 * @example
 * ```typescript
 * app.use('/api', requireAuth, apiRouter);
 * ```
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const auth = extractAuthContext(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized - missing or invalid auth context' });
    }

    // Attach to request for downstream use
    (req as AuthenticatedRequest).auth = auth;
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
    const authReq = req as AuthenticatedRequest;

    // First check if middleware attached it
    if (authReq.auth) {
        return authReq.auth;
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
 * @deprecated Use `mockAuthHeaders` for E2E tests or pass Authorization header directly with JWT token.
 */
export function authHeaders(
    userId: string,
    tenantId: string,
    extras?: { email?: string; roles?: string[]; token?: string }
): Record<string, string> {
    if (extras?.token) {
        return { 'Authorization': `Bearer ${extras.token}` };
    }

    return {
        'x-authorizer-user-id': userId,
        'x-authorizer-tenant-id': tenantId,
        ...(extras?.email && { 'x-authorizer-email': extras.email }),
        ...(extras?.roles && { 'x-authorizer-roles': JSON.stringify(extras.roles) }),
    };
}

/**
 * Generate mock authorization headers for unit tests.
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
 * Supports both legacy names (SUPER_ADMIN) and bootstrap names (admin).
 */
export const ROLES = {
    // Legacy role names (uppercase)
    SUPER_ADMIN: 'SUPER_ADMIN',
    TENANT_ADMIN: 'TENANT_ADMIN',
    LOAN_OFFICER: 'LOAN_OFFICER',
    CUSTOMER: 'CUSTOMER',
    VIEWER: 'VIEWER',
    /** Property developers who list properties and upload sales offer letters */
    DEVELOPER: 'DEVELOPER',
    /** Bank/financial institution representatives who upload preapproval and mortgage offer letters */
    LENDER: 'LENDER',
    /** Legal officers who upload final offer letters and handle legal documentation */
    LEGAL: 'LEGAL',
    // Bootstrap role names (lowercase) - created by tenant bootstrap
    ADMIN: 'admin',
    USER: 'user',
    MORTGAGE_OPS: 'mortgage_ops',
    FINANCE: 'finance',
    LEGAL_TEAM: 'legal',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/**
 * Roles that have admin privileges (can manage resources).
 * Includes both legacy uppercase names and bootstrap lowercase names.
 */
export const ADMIN_ROLES: string[] = [
    ROLES.SUPER_ADMIN,
    ROLES.TENANT_ADMIN,
    ROLES.LOAN_OFFICER,
    ROLES.ADMIN,           // Bootstrap 'admin' role
    ROLES.MORTGAGE_OPS,    // Bootstrap 'mortgage_ops' role
];

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
