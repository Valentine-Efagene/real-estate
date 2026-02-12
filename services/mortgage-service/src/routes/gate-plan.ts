import { Router, Request, Response, NextFunction } from 'express';
import { createGatePlanService } from '../services/gate-plan.service';
import { CreateGatePlanSchema, UpdateGatePlanSchema } from '../validators/gate-plan.validator';
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

function getService(req: Request) {
    return createGatePlanService(getTenantPrisma(req));
}

// Create gate plan (admin only)
router.post('/', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreateGatePlanSchema.parse(req.body);
        const service = getService(req);
        const plan = await service.create(tenantId, data);
        res.status(201).json(successResponse(plan));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// List gate plans
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const service = getService(req);
        const plans = await service.findAll({ isActive });
        res.json(successResponse(plans));
    } catch (error) {
        next(error);
    }
});

// Get gate plan by ID
router.get('/:id', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const service = getService(req);
        const plan = await service.findById(req.params.id);
        res.json(successResponse(plan));
    } catch (error) {
        next(error);
    }
});

// Update gate plan
router.put('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateGatePlanSchema.parse(req.body);
        const service = getService(req);
        const plan = await service.update(req.params.id, data);
        res.json(successResponse(plan));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete gate plan
router.delete('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const service = getService(req);
        const result = await service.delete(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

export default router;
