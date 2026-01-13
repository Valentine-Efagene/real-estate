/**
 * Tenant-scoped service factory helpers.
 * 
 * These helpers create service instances using the tenant-scoped Prisma client
 * from the request. This ensures all database queries are automatically filtered
 * by tenant and all creates inject the correct tenantId.
 * 
 * @example
 * ```typescript
 * router.get('/applications', requireTenant, async (req, res, next) => {
 *     const service = getTenantApplicationService(req);
 *     const apps = await service.findAll();
 *     res.json(successResponse(apps));
 * });
 * ```
 */

import { Request } from 'express';
import { PrismaClient, AppError } from '@valentine-efagene/qshelter-common';
import { createApplicationService, ApplicationService } from '../services/application.service';
import { createPaymentMethodService, PaymentMethodService } from '../services/payment-method.service';
import { createOfferLetterService, OfferLetterService } from '../services/offer-letter.service';
import { createApplicationTerminationService, ApplicationTerminationService } from '../services/application-termination.service';
import { createPaymentPlanService, PaymentPlanService } from '../services/payment-plan.service';

// Note: ApplicationPhaseService and ApplicationPaymentService still use class-based singletons
// and need to be refactored to factory pattern for proper tenant scoping.

/**
 * Get the tenant-scoped Prisma client from the request.
 * Throws if not available (requireTenant middleware not applied).
 */
export function getTenantPrisma(req: Request): PrismaClient {
    const prisma = req.tenantPrisma as PrismaClient | undefined;
    if (!prisma) {
        throw new AppError(500, 'Tenant Prisma client not initialized. Ensure tenant middleware is applied.');
    }
    return prisma;
}

/**
 * Get tenant-scoped ApplicationService.
 */
export function getTenantApplicationService(req: Request): ApplicationService {
    return createApplicationService(getTenantPrisma(req));
}

/**
 * Get tenant-scoped PaymentMethodService.
 */
export function getTenantPaymentMethodService(req: Request): PaymentMethodService {
    return createPaymentMethodService(getTenantPrisma(req));
}

/**
 * Get tenant-scoped OfferLetterService.
 */
export function getTenantOfferLetterService(req: Request): OfferLetterService {
    return createOfferLetterService(getTenantPrisma(req));
}

/**
 * Get tenant-scoped ApplicationTerminationService.
 */
export function getTenantApplicationTerminationService(req: Request): ApplicationTerminationService {
    return createApplicationTerminationService(getTenantPrisma(req));
}

/**
 * Get tenant-scoped PaymentPlanService.
 */
export function getTenantPaymentPlanService(req: Request): PaymentPlanService {
    return createPaymentPlanService(getTenantPrisma(req));
}

// TODO: Refactor ApplicationPhaseService and ApplicationPaymentService to factory pattern
// so they can be tenant-scoped. Currently they use class-based singletons with global prisma.
