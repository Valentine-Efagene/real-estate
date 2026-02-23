import { Router, Request, Response, NextFunction } from 'express';
import { createQualificationFlowService } from '../services/qualification-flow.service';
import {
    CreateQualificationFlowSchema,
    UpdateQualificationFlowSchema,
    ApplyForPaymentMethodSchema,
    ReviewQualificationSchema,
    UpdateQualificationStatusSchema,
    AssignQualificationFlowSchema,
} from '../validators/qualification-flow.validator';
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

/** Helper to get tenant-scoped qualification flow service from request */
function getService(req: Request) {
    return createQualificationFlowService(getTenantPrisma(req));
}

// =============================================================================
// QUALIFICATION FLOW TEMPLATE CRUD
// =============================================================================

/**
 * POST /qualification-flows
 * Create a new qualification flow template
 */
router.post('/', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreateQualificationFlowSchema.parse(req.body);
        const service = getService(req);
        const result = await service.createFlow(tenantId, data);
        res.status(201).json(successResponse(result));
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * GET /qualification-flows
 * List all qualification flow templates
 */
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const service = getService(req);
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const flows = await service.findAllFlows({ isActive });
        res.json(successResponse(flows));
    } catch (error: any) {
        next(error);
    }
});

/**
 * GET /qualification-flows/:id
 * Get a qualification flow template by ID
 */
router.get('/:id', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const service = getService(req);
        const flow = await service.findFlowById(req.params.id as string);
        res.json(successResponse(flow));
    } catch (error: any) {
        next(error);
    }
});

/**
 * PUT /qualification-flows/:id
 * Update a qualification flow template
 */
router.put('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateQualificationFlowSchema.parse(req.body);
        const service = getService(req);
        const result = await service.updateFlow(req.params.id as string, data);
        res.json(successResponse(result));
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * DELETE /qualification-flows/:id
 * Delete a qualification flow template
 */
router.delete('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const service = getService(req);
        const result = await service.deleteFlow(req.params.id as string);
        res.json(successResponse(result));
    } catch (error: any) {
        next(error);
    }
});

export default router;
