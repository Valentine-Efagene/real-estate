import { Router, Request, Response, NextFunction } from 'express';
import { createQuestionnairePlanService } from '../services/questionnaire-plan.service';
import {
    CreateQuestionnairePlanSchema,
    UpdateQuestionnairePlanSchema,
    AddQuestionToPlanSchema,
    CalculateScoreSchema,
} from '../validators/questionnaire-plan.validator';
import { z } from 'zod';
import {
    getAuthContext,
    successResponse,
    requireTenant,
    requirePlatformRole as requireRole,
    PLATFORM_ADMIN_ROLES as ADMIN_ROLES,
} from '@valentine-efagene/qshelter-common';
import { getTenantPrisma } from '../lib/tenant-services';

const router: Router = Router();

/**
 * Helper to get tenant-scoped questionnaire plan service from request
 */
function getQuestionnairePlanService(req: Request) {
    return createQuestionnairePlanService(getTenantPrisma(req));
}

// Create questionnaire plan (admin only)
router.post('/', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreateQuestionnairePlanSchema.parse(req.body);
        const questionnairePlanService = getQuestionnairePlanService(req);
        const plan = await questionnairePlanService.create(tenantId, data);
        res.status(201).json(successResponse(plan));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all questionnaire plans (public - customers need to see available plans)
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const questionnairePlanService = getQuestionnairePlanService(req);
        const plans = await questionnairePlanService.findAll({ isActive, category });
        res.json(successResponse(plans));
    } catch (error) {
        next(error);
    }
});

// Get questionnaire plan by ID
router.get('/:id', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const questionnairePlanService = getQuestionnairePlanService(req);
        const plan = await questionnairePlanService.findById(req.params.id as string);
        res.json(successResponse(plan));
    } catch (error) {
        next(error);
    }
});

// Update questionnaire plan (admin only)
router.patch('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateQuestionnairePlanSchema.parse(req.body);
        const questionnairePlanService = getQuestionnairePlanService(req);
        const plan = await questionnairePlanService.update(req.params.id as string, data);
        res.json(successResponse(plan));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete questionnaire plan (admin only)
router.delete('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const questionnairePlanService = getQuestionnairePlanService(req);
        const result = await questionnairePlanService.delete(req.params.id as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Clone questionnaire plan (admin only)
router.post('/:id/clone', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, incrementVersion } = req.body;
        if (!name && !incrementVersion) {
            res.status(400).json({ success: false, error: 'Either name or incrementVersion is required for cloning' });
            return;
        }
        const questionnairePlanService = getQuestionnairePlanService(req);
        const plan = await questionnairePlanService.clone(req.params.id as string, name || '', incrementVersion === true);
        res.status(201).json(successResponse(plan));
    } catch (error) {
        next(error);
    }
});

// Calculate score for answers against a plan
router.post('/:id/score', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CalculateScoreSchema.parse(req.body);
        const questionnairePlanService = getQuestionnairePlanService(req);
        const result = await questionnairePlanService.calculateScore(req.params.id as string, data);
        res.json(successResponse(result));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Add question to plan (admin only)
router.post('/:id/questions', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddQuestionToPlanSchema.parse(req.body);
        const questionnairePlanService = getQuestionnairePlanService(req);
        const question = await questionnairePlanService.addQuestion(req.params.id as string, data);
        res.status(201).json(successResponse(question));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update question in plan (admin only)
router.patch('/:id/questions/:questionId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddQuestionToPlanSchema.partial().parse(req.body);
        const questionnairePlanService = getQuestionnairePlanService(req);
        const question = await questionnairePlanService.updateQuestion(req.params.id as string, req.params.questionId as string, data);
        res.json(successResponse(question));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Remove question from plan (admin only)
router.delete('/:id/questions/:questionId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const questionnairePlanService = getQuestionnairePlanService(req);
        const result = await questionnairePlanService.removeQuestion(req.params.id as string, req.params.questionId as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

export default router;
