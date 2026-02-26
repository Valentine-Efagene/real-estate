import { Router, Request, Response, NextFunction } from 'express';
import { createDocumentationPlanService } from '../services/documentation-plan.service';
import {
    CreateDocumentationPlanSchema,
    UpdateDocumentationPlanSchema,
    AddDocumentDefinitionSchema,
    AddApprovalStageSchema,
} from '../validators/documentation-plan.validator';
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

// =========================================================================
// DOCUMENT DEFINITION ROUTES
// =========================================================================

// Add document definition to plan (admin only)
router.post('/:id/document-definitions', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddDocumentDefinitionSchema.parse(req.body);
        const documentationPlanService = getDocumentationPlanService(req);
        const definition = await documentationPlanService.addDocumentDefinition(req.params.id as string, data);
        res.status(201).json(successResponse(definition));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update document definition in plan (admin only)
router.patch('/:id/document-definitions/:definitionId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddDocumentDefinitionSchema.partial().parse(req.body);
        const documentationPlanService = getDocumentationPlanService(req);
        const definition = await documentationPlanService.updateDocumentDefinition(req.params.id as string, req.params.definitionId as string, data);
        res.json(successResponse(definition));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Remove document definition from plan (admin only)
router.delete('/:id/document-definitions/:definitionId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const documentationPlanService = getDocumentationPlanService(req);
        const result = await documentationPlanService.removeDocumentDefinition(req.params.id as string, req.params.definitionId as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// =========================================================================
// APPROVAL STAGE ROUTES
// =========================================================================

// Add approval stage to plan (admin only)
router.post('/:id/approval-stages', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddApprovalStageSchema.parse(req.body);
        const documentationPlanService = getDocumentationPlanService(req);
        const stage = await documentationPlanService.addApprovalStage(req.params.id as string, data);
        res.status(201).json(successResponse(stage));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update approval stage in plan (admin only)
router.patch('/:id/approval-stages/:stageId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddApprovalStageSchema.partial().parse(req.body);
        const documentationPlanService = getDocumentationPlanService(req);
        const stage = await documentationPlanService.updateApprovalStage(req.params.id as string, req.params.stageId as string, data);
        res.json(successResponse(stage));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Remove approval stage from plan (admin only)
router.delete('/:id/approval-stages/:stageId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const documentationPlanService = getDocumentationPlanService(req);
        const result = await documentationPlanService.removeApprovalStage(req.params.id as string, req.params.stageId as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// =========================================================================
// EFFECTIVE DOCUMENT REQUIREMENTS (Bank Overlay Merge)
// =========================================================================

/**
 * GET /phases/:phaseId/effective-requirements
 * 
 * Get effective document requirements by merging the phase's documentation plan
 * with bank-specific overlays for that phase.
 * 
 * Query params:
 * - bankOrganizationId (required): The bank's organization ID
 * 
 * The phase determines:
 * - Which DocumentationPlan to use (phase.documentationPlanId)
 * - Which BankDocumentRequirements to apply (scoped to this exact phase)
 */
router.get('/phases/:phaseId/effective-requirements', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phaseId } = req.params;
        const { bankOrganizationId } = req.query;

        if (!bankOrganizationId || typeof bankOrganizationId !== 'string') {
            res.status(400).json({ success: false, error: 'bankOrganizationId query parameter is required' });
            return;
        }

        const documentationPlanService = getDocumentationPlanService(req);
        const requirements = await documentationPlanService.getEffectiveDocumentRequirements(
            phaseId as string,
            bankOrganizationId
        );

        res.json(successResponse({
            phaseId,
            bankOrganizationId,
            requirements,
            totalRequired: requirements.filter(r => r.isRequired).length,
            totalOptional: requirements.filter(r => !r.isRequired).length,
        }));
    } catch (error) {
        next(error);
    }
});

export default router;
