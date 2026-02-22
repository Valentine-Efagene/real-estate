import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../../generated/client/client';
import { AppError } from '../utils/errors';
import {
    TenantContext,
    TenantPrismaClient,
    createTenantPrisma,
} from '../prisma/tenant';
import { extractAuthContext } from './auth-context';

/**
 * Extend Express Request to include tenant context and scoped Prisma client
 */
declare global {
    namespace Express {
        interface Request {
            tenantContext?: TenantContext;
            tenantPrisma?: TenantPrismaClient | PrismaClient;
        }
    }
}

/**
 * Options for tenant middleware
 */
export interface TenantMiddlewareOptions {
    /**
     * The base Prisma client to use for creating tenant-scoped clients
     */
    prisma: PrismaClient;
    /**
     * Whether to create a tenant-scoped Prisma client automatically
     * If false, only tenantContext is attached to the request
     * @default true
     */
    createScopedClient?: boolean;
}

/**
 * Creates a tenant middleware that extracts tenant context from the JWT
 * and optionally creates a tenant-scoped Prisma client.
 *
 * Uses extractAuthContext() which reads the JWT from the Authorization header
 * and verifies it if configureAuth() has been called.
 *
 * @example
 * ```ts
 * import { createTenantMiddleware } from '@valentine-efagene/qshelter-common';
 * import { prisma } from './lib/prisma';
 *
 * app.use(createTenantMiddleware({ prisma }));
 * ```
 */
export function createTenantMiddleware(options: TenantMiddlewareOptions) {
    const { prisma, createScopedClient = true } = options;

    return function tenantMiddleware(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const authContext = extractAuthContext(req);

            const tenantId = authContext?.tenantId;
            const userId = authContext?.userId;

            if (!tenantId) {
                // Allow requests without tenant context for development
                console.warn('Request without tenant context:', req.path);
                return next();
            }

            const tenantContext: TenantContext = {
                tenantId,
                userId,
            };

            // Attach tenant context to request
            req.tenantContext = tenantContext;

            // Create tenant-scoped Prisma client if enabled
            if (createScopedClient) {
                req.tenantPrisma = createTenantPrisma(prisma, tenantContext);
            } else {
                req.tenantPrisma = prisma;
            }

            next();
        } catch (error) {
            console.error('Tenant middleware error:', error);
            next(error);
        }
    };
}

/**
 * Middleware that requires tenant context.
 * Use this for routes that must have tenant scoping.
 */
export function requireTenant(
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (!req.tenantContext?.tenantId) {
        return next(new AppError(400, 'Tenant context required'));
    }

    if (!req.tenantPrisma) {
        return next(new AppError(500, 'Tenant Prisma client not initialized'));
    }

    next();
}

/**
 * Helper to get tenant-scoped Prisma client from request.
 * Throws if not available.
 */
export function getTenantPrisma(req: Request): TenantPrismaClient | PrismaClient {
    if (!req.tenantPrisma) {
        throw new AppError(500, 'Tenant context not available');
    }
    return req.tenantPrisma;
}

/**
 * Helper to get tenant context from request.
 * Throws if not available.
 */
export function getTenantContext(req: Request): TenantContext {
    if (!req.tenantContext) {
        throw new AppError(500, 'Tenant context not available');
    }
    return req.tenantContext;
}
