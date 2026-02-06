import { Router, Request, Response, NextFunction } from 'express';
import { createPaymentPlanService } from '../services/payment-plan.service';
import { CreatePaymentPlanSchema, UpdatePaymentPlanSchema } from '../validators/payment-plan.validator';
import { z } from 'zod';
import {
    getAuthContext,
    successResponse,
    requireTenant,
    requireRole,
    ADMIN_ROLES,
} from '@valentine-efagene/qshelter-common';
import { getTenantPrisma } from '../lib/tenant-services';

const router: Router = Router();

/**
 * Helper to get tenant-scoped payment plan service from request
 */
function getPaymentPlanService(req: Request) {
    return createPaymentPlanService(getTenantPrisma(req));
}

// Create payment plan (admin only)
router.post('/', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreatePaymentPlanSchema.parse(req.body);
        const paymentPlanService = getPaymentPlanService(req);
        const plan = await paymentPlanService.create(tenantId, data);
        // Include interestRate from input in response (interest rate is phase-specific, but echoed for convenience)
        res.status(201).json(successResponse({ ...plan, interestRate: data.interestRate }));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all payment plans (public - customers need to see available plans)
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const paymentPlanService = getPaymentPlanService(req);
        const plans = await paymentPlanService.findAll({ isActive });
        res.json(successResponse(plans));
    } catch (error) {
        next(error);
    }
});

// Get payment plan by ID
router.get('/:id', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentPlanService = getPaymentPlanService(req);
        const plan = await paymentPlanService.findById(req.params.id as string);
        res.json(successResponse(plan));
    } catch (error) {
        next(error);
    }
});

// Update payment plan (admin only)
router.patch('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdatePaymentPlanSchema.parse(req.body);
        const paymentPlanService = getPaymentPlanService(req);
        const plan = await paymentPlanService.update(req.params.id as string, data);
        res.json(successResponse(plan));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete payment plan (admin only)
router.delete('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentPlanService = getPaymentPlanService(req);
        const result = await paymentPlanService.delete(req.params.id as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Clone payment plan (admin only)
router.post('/:id/clone', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ success: false, error: 'name is required for cloning' });
            return;
        }
        const paymentPlanService = getPaymentPlanService(req);
        const plan = await paymentPlanService.clone(req.params.id as string, name);
        res.status(201).json(successResponse(plan));
    } catch (error) {
        next(error);
    }
});

export default router;
