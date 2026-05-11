import { Request, Response, NextFunction } from 'express';

/**
 * Authentication context extracted from x-authorizer-* headers.
 * These headers are injected by the Lambda handler from the API Gateway authorizer context.
 * For service E2E tests, the same headers can be sent as mock values directly.
 */
export interface AuthContext {
    userId: string;
    tenantId: string;
    email?: string;
    roles?: string[];
    orgRole?: string;
    orgRoles?: string[];
    activeOrgId?: string;
    isPlatformOrg?: boolean;
}

interface AuthenticatedRequest extends Request {
    auth?: AuthContext;
}

/**
 * Extracts auth context from x-authorizer-* headers injected by the Lambda handler
 * (which reads them from the API Gateway Lambda authorizer context).
 * The same headers can be set manually in service E2E tests.
 *
 * LocalStack bypass: when STAGE=localstack, if no x-authorizer-* headers are present,
 * falls back to decoding the Bearer JWT directly (no signature verification).
 * This is safe because LocalStack is only used for local development.
 */
export function extractAuthContext(req: Request): AuthContext | null {
    const userId = req.headers['x-authorizer-user-id'] as string;
    const tenantId = req.headers['x-authorizer-tenant-id'] as string;

    if (userId && tenantId) {
        const rolesHeader = req.headers['x-authorizer-roles'] as string;
        return {
            userId,
            tenantId,
            email: req.headers['x-authorizer-email'] as string,
            roles: rolesHeader ? JSON.parse(rolesHeader) : [],
            orgRole: req.headers['x-authorizer-org-role'] as string,
            orgRoles: req.headers['x-authorizer-org-roles']
                ? JSON.parse(req.headers['x-authorizer-org-roles'] as string)
                : undefined,
            activeOrgId: req.headers['x-authorizer-active-org-id'] as string,
            isPlatformOrg: req.headers['x-authorizer-is-platform-org'] === 'true',
        };
    }

    // LocalStack/local-dev bypass: decode JWT without verification
    if (process.env.STAGE === 'localstack') {
        const authHeader = req.headers['authorization'] as string;
        const token = authHeader?.replace(/^Bearer\s+/i, '');
        if (token) {
            try {
                const payloadB64 = token.split('.')[1];
                const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
                if (payload.sub && payload.tenantId) {
                    return {
                        userId: payload.sub,
                        tenantId: payload.tenantId,
                        email: payload.email,
                        roles: payload.roles ?? [],
                        orgRole: payload.orgRole,
                        orgRoles: payload.orgRoles,
                        activeOrgId: payload.activeOrgId,
                        isPlatformOrg: payload.isPlatformOrg ?? false,
                    };
                }
            } catch {
                // malformed token — fall through to null
            }
        }
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
 * Generate mock authorization headers for service E2E tests.
 */
export function mockAuthHeaders(
    userId: string,
    tenantId: string,
    options?: { email?: string; roles?: string[]; orgRole?: string; orgRoles?: string[]; activeOrgId?: string; isPlatformOrg?: boolean }
): Record<string, string> {
    return {
        'x-authorizer-user-id': userId,
        'x-authorizer-tenant-id': tenantId,
        ...(options?.email && { 'x-authorizer-email': options.email }),
        ...(options?.roles && { 'x-authorizer-roles': JSON.stringify(options.roles) }),
        ...(options?.orgRole && { 'x-authorizer-org-role': options.orgRole }),
        ...(options?.orgRoles && { 'x-authorizer-org-roles': JSON.stringify(options.orgRoles) }),
        ...(options?.activeOrgId && { 'x-authorizer-active-org-id': options.activeOrgId }),
        ...(options?.isPlatformOrg !== undefined && { 'x-authorizer-is-platform-org': String(options.isPlatformOrg) }),
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
    AGENT: 'agent',
    LENDER_OPS: 'lender_ops',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/**
 * Roles that have admin privileges (can manage resources).
 * Includes both legacy uppercase names and bootstrap lowercase names.
 *
 * NOTE: With org-scoped RBAC, ADMIN_ROLES is used for the legacy `roles[]` JWT field.
 * Prefer isPlatformAdmin() or requirePlatformRole() for new code.
 */
export const ADMIN_ROLES: string[] = [
    ROLES.SUPER_ADMIN,
    ROLES.TENANT_ADMIN,
    ROLES.LOAN_OFFICER,
    ROLES.ADMIN,           // Bootstrap 'admin' role
    ROLES.MORTGAGE_OPS,    // Bootstrap 'mortgage_ops' role
];

/**
 * Roles that grant platform-wide administrative powers when held
 * in the PLATFORM organization. Only platform org admins get god-mode.
 */
export const PLATFORM_ADMIN_ROLES: string[] = [
    ROLES.ADMIN,
    ROLES.MORTGAGE_OPS,
];

/**
 * Tenant-level god-mode roles.
 * These roles bypass org-scoped restrictions and retain tenant-wide access.
 */
export const TENANT_GOD_MODE_ROLES: string[] = [
    ROLES.SUPER_ADMIN,
];

/**
 * Check if user has any of the specified roles.
 * Works with both legacy roles[] and new orgRole.
 */
export function hasAnyRole(userRoles: string[] | undefined, requiredRoles: string[]): boolean {
    if (!userRoles || userRoles.length === 0) return false;
    return requiredRoles.some(role => userRoles.includes(role));
}

/**
 * Check if user has admin privileges.
 * With org-scoped RBAC: checks if user is admin/mortgage_ops in the PLATFORM org.
 * Falls back to legacy flat roles check for backward compatibility.
 */
export function isAdmin(userRoles: string[] | undefined, auth?: AuthContext): boolean {
    // Tenant-level god mode
    if (hasAnyRole(userRoles, TENANT_GOD_MODE_ROLES)) {
        return true;
    }

    // New path: check org-scoped role
    if (auth?.isPlatformOrg) {
        const activeOrgRoles = auth.orgRoles && auth.orgRoles.length > 0
            ? auth.orgRoles
            : (auth.orgRole ? [auth.orgRole] : []);
        if (activeOrgRoles.some((role) => PLATFORM_ADMIN_ROLES.includes(role))) {
            return true;
        }
    }
    // Legacy fallback: check flat roles array
    return hasAnyRole(userRoles, ADMIN_ROLES);
}

/**
 * Check if user is acting as a platform administrator.
 * True only if the user's active organization is the PLATFORM org
 * AND their org role is admin or mortgage_ops.
 *
 * This replaces the old isAdmin() god-mode check with an org-scoped version.
 */
export function isPlatformAdmin(auth: AuthContext): boolean {
    if (!auth.isPlatformOrg) return false;
    const activeOrgRoles = auth.orgRoles && auth.orgRoles.length > 0
        ? auth.orgRoles
        : (auth.orgRole ? [auth.orgRole] : []);
    return activeOrgRoles.some((role) => PLATFORM_ADMIN_ROLES.includes(role));
}

/**
 * Check if user has a specific org-scoped role.
 * Checks the orgRole from the active organization in the JWT.
 */
export function hasOrgRole(auth: AuthContext, allowedRoles: string[]): boolean {
    const activeOrgRoles = auth.orgRoles && auth.orgRoles.length > 0
        ? auth.orgRoles
        : (auth.orgRole ? [auth.orgRole] : []);
    if (!activeOrgRoles.length) return false;
    return allowedRoles.some((role) => activeOrgRoles.includes(role));
}

/**
 * Middleware factory that requires user to have specific role(s).
 * Checks both org-scoped orgRole (preferred) and legacy roles[] (fallback).
 *
 * @example
 * ```typescript
 * // Require any admin role (platform org admin or legacy admin)
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

        // Check org-scoped role first, then fall back to legacy roles
        const activeOrgRoles = auth.orgRoles && auth.orgRoles.length > 0
            ? auth.orgRoles
            : (auth.orgRole ? [auth.orgRole] : []);
        const hasOrgMatch = allowedRoles.some((role) => activeOrgRoles.includes(role));
        const hasLegacyMatch = hasAnyRole(auth.roles, allowedRoles);

        if (!hasOrgMatch && !hasLegacyMatch) {
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
 * Middleware that requires the user to be a platform admin
 * (admin or mortgage_ops role in the PLATFORM organization).
 *
 * This provides tenant-wide administrative powers, replacing the old
 * requireRole(ADMIN_ROLES) pattern for routes that should only be accessible
 * to platform staff, not third-party org staff.
 *
 * Falls back to legacy ADMIN_ROLES check during migration period.
 *
 * @example
 * ```typescript
 * router.post('/payment-methods', requirePlatformRole(PLATFORM_ADMIN_ROLES), createPaymentMethod);
 * ```
 */
export function requirePlatformRole(allowedRoles: string[]) {
    return function (req: Request, res: Response, next: NextFunction) {
        const auth = extractAuthContext(req);

        if (!auth) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - authentication required'
            });
        }

        // New path: check if platform org member with correct role
        const activeOrgRoles = auth.orgRoles && auth.orgRoles.length > 0
            ? auth.orgRoles
            : (auth.orgRole ? [auth.orgRole] : []);
        if (auth.isPlatformOrg && allowedRoles.some((role) => activeOrgRoles.includes(role))) {
            return next();
        }

        // Tenant-level god mode bypass
        if (hasAnyRole(auth.roles, TENANT_GOD_MODE_ROLES)) {
            return next();
        }

        // Legacy fallback: check flat roles for backward compatibility during migration
        if (hasAnyRole(auth.roles, allowedRoles)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'Forbidden - platform admin role required',
            requiredRoles: allowedRoles,
        });
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
