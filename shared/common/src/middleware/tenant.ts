import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../../generated/client/client';
import { AppError } from '../utils/errors';
import {
    TenantContext,
    TenantPrismaClient,
    createTenantPrisma,
} from '../prisma/tenant';

/**
 * Extend Express Request to include tenant context and scoped Prisma client
 */
declare global {
    namespace Express {
        interface Request {
            tenantContext?: TenantContext;
            tenantPrisma?: TenantPrismaClient | PrismaClient;
            /**
             * API Gateway context added by serverless-express
             */
            apiGateway?: {
                event: {
                    requestContext: {
                        authorizer?: {
                            userId?: string;
                            email?: string;
                            roles?: string;
                            tenantId?: string;
                        };
                    };
                };
            };
        }
    }
}

/**
 * Fallback headers for local development or alternative setups
 */
interface AuthorizerHeaders {
    'x-user-id'?: string;
    'x-tenant-id'?: string;
    'x-user-email'?: string;
    'x-user-roles'?: string;
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
 * Creates a tenant middleware that extracts tenant context from the request
 * and optionally creates a tenant-scoped Prisma client.
 *
 * The API Gateway authorizer is expected to set:
 * - x-tenant-id: The tenant ID from the JWT
 * - x-user-id: The user ID from the JWT
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
            // 1. Try Lambda authorizer context first (production)
            const authorizerContext = req.apiGateway?.event?.requestContext?.authorizer;

            // 2. Fall back to headers (local dev or alternative setups)
            const headers = req.headers as unknown as AuthorizerHeaders;

            const tenantId = authorizerContext?.tenantId || headers['x-tenant-id'];
            const userId = authorizerContext?.userId || headers['x-user-id'];

            if (!tenantId) {
                // For now, allow requests without tenant context for development
                // In production, you might want to reject these
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
