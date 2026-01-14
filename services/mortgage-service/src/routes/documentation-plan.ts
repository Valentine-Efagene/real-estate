import { Router, Request, Response, NextFunction } from 'express';
import { createDocumentationPlanService } from '../services/documentation-plan.service';
import {
    CreateDocumentationPlanSchema,
    UpdateDocumentationPlanSchema,
    AddStepToPlanSchema,
} from '../validators/documentation-plan.validator';
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
 * Helper to get tenant-scoped documentation plan service from request
 */
function getDocumentationPlanService(req: Request) {
    return createDocumentationPlanService(getTenantPrisma(req));
}

// Create documentation plan (admin only)
router.post('/', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreateDocumentationPlanSchema.parse(req.body);
        const documentationPlanService = getDocumentationPlanService(req);
        const plan = await documentationPlanService.create(tenantId, data);
        res.status(201).json(successResponse(plan));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all documentation plans (public - customers need to see available plans)
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const documentationPlanService = getDocumentationPlanService(req);
        const plans = await documentationPlanService.findAll({ isActive });
        res.json(successResponse(plans));
    } catch (error) {
        next(error);
    }
});

// Get documentation plan by ID
router.get('/:id', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const documentationPlanService = getDocumentationPlanService(req);
        const plan = await documentationPlanService.findById(req.params.id as string);
        res.json(successResponse(plan));
    } catch (error) {
        next(error);
    }
});

// Update documentation plan (admin only)
router.patch('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateDocumentationPlanSchema.parse(req.body);
        const documentationPlanService = getDocumentationPlanService(req);
        const plan = await documentationPlanService.update(req.params.id as string, data);
        res.json(successResponse(plan));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete documentation plan (admin only)
router.delete('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const documentationPlanService = getDocumentationPlanService(req);
        const result = await documentationPlanService.delete(req.params.id as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Clone documentation plan (admin only)
router.post('/:id/clone', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ success: false, error: 'name is required for cloning' });
            return;
        }
        const documentationPlanService = getDocumentationPlanService(req);
        const plan = await documentationPlanService.clone(req.params.id as string, name);
        res.status(201).json(successResponse(plan));
    } catch (error) {
        next(error);
    }
});

// Add step to plan (admin only)
router.post('/:id/steps', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddStepToPlanSchema.parse(req.body);
        const documentationPlanService = getDocumentationPlanService(req);
        const step = await documentationPlanService.addStep(req.params.id as string, data);
        res.status(201).json(successResponse(step));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update step in plan (admin only)
router.patch('/:id/steps/:stepId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddStepToPlanSchema.partial().parse(req.body);
        const documentationPlanService = getDocumentationPlanService(req);
        const step = await documentationPlanService.updateStep(req.params.id as string, req.params.stepId as string, data);
        res.json(successResponse(step));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Remove step from plan (admin only)
router.delete('/:id/steps/:stepId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const documentationPlanService = getDocumentationPlanService(req);
        const result = await documentationPlanService.removeStep(req.params.id as string, req.params.stepId as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

export default router;
