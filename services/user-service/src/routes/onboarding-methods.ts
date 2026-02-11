import { Router } from 'express';
import {
    successResponse,
    getAuthContext,
    hasAnyRole,
    ADMIN_ROLES,
} from '@valentine-efagene/qshelter-common';
import { onboardingMethodService } from '../services/onboarding-method.service';
import { z } from 'zod';

export const onboardingMethodRouter = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateMethodSchema = z.object({
    name: z.string().min(2).max(200),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    autoActivatePhases: z.boolean().optional(),
    expiresInDays: z.number().int().positive().nullable().optional(),
});

const UpdateMethodSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    autoActivatePhases: z.boolean().optional(),
    expiresInDays: z.number().int().positive().nullable().optional(),
});

const AddPhaseSchema = z.object({
    name: z.string().min(2).max(200),
    description: z.string().optional(),
    phaseCategory: z.enum(['QUESTIONNAIRE', 'DOCUMENTATION', 'GATE']),
    phaseType: z.string().min(1),
    order: z.number().int().positive(),
    requiresPreviousPhaseCompletion: z.boolean().optional(),
    questionnairePlanId: z.string().optional(),
    documentationPlanId: z.string().optional(),
    gatePlanId: z.string().optional(),
});

const UpdatePhaseSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().optional(),
    phaseType: z.string().min(1).optional(),
    order: z.number().int().positive().optional(),
    requiresPreviousPhaseCompletion: z.boolean().optional(),
    questionnairePlanId: z.string().nullable().optional(),
    documentationPlanId: z.string().nullable().optional(),
    gatePlanId: z.string().nullable().optional(),
});

const LinkOrgTypeSchema = z.object({
    organizationTypeId: z.string().min(1),
});

// =============================================================================
// REFERENCE DATA (must come before /:id to avoid param matching)
// =============================================================================

/**
 * List available plans and org types for building onboarding methods.
 * GET /onboarding-methods/reference/plans
 */
onboardingMethodRouter.get('/reference/plans', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const [questionnairePlans, documentationPlans, gatePlans, orgTypes] = await Promise.all([
            onboardingMethodService.listQuestionnairePlans(ctx.tenantId),
            onboardingMethodService.listDocumentationPlans(ctx.tenantId),
            onboardingMethodService.listGatePlans(ctx.tenantId),
            onboardingMethodService.listOrgTypes(ctx.tenantId),
        ]);
        res.json(successResponse({ questionnairePlans, documentationPlans, gatePlans, orgTypes }));
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// CRUD ROUTES
// =============================================================================

/**
 * List all onboarding methods.
 * GET /onboarding-methods
 */
onboardingMethodRouter.get('/', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const result = await onboardingMethodService.list(ctx.tenantId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Get onboarding method by ID.
 * GET /onboarding-methods/:id
 */
onboardingMethodRouter.get('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const result = await onboardingMethodService.findById(ctx.tenantId, req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Create a new onboarding method.
 * POST /onboarding-methods
 * Admin only.
 */
onboardingMethodRouter.post('/', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = CreateMethodSchema.parse(req.body);
        const result = await onboardingMethodService.create(ctx.tenantId, data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Update an onboarding method.
 * PATCH /onboarding-methods/:id
 * Admin only.
 */
onboardingMethodRouter.patch('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = UpdateMethodSchema.parse(req.body);
        const result = await onboardingMethodService.update(ctx.tenantId, req.params.id, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Delete an onboarding method.
 * DELETE /onboarding-methods/:id
 * Admin only.
 */
onboardingMethodRouter.delete('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const result = await onboardingMethodService.delete(ctx.tenantId, req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// PHASE ROUTES
// =============================================================================

/**
 * Add a phase to an onboarding method.
 * POST /onboarding-methods/:id/phases
 * Admin only.
 */
onboardingMethodRouter.post('/:id/phases', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = AddPhaseSchema.parse(req.body);
        const result = await onboardingMethodService.addPhase(ctx.tenantId, req.params.id, data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Update a phase.
 * PATCH /onboarding-methods/:id/phases/:phaseId
 * Admin only.
 */
onboardingMethodRouter.patch('/:id/phases/:phaseId', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = UpdatePhaseSchema.parse(req.body);
        const result = await onboardingMethodService.updatePhase(ctx.tenantId, req.params.id, req.params.phaseId, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Remove a phase.
 * DELETE /onboarding-methods/:id/phases/:phaseId
 * Admin only.
 */
onboardingMethodRouter.delete('/:id/phases/:phaseId', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const result = await onboardingMethodService.removePhase(ctx.tenantId, req.params.id, req.params.phaseId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// ORG TYPE LINKING
// =============================================================================

/**
 * Link an onboarding method to an organization type.
 * POST /onboarding-methods/:id/org-types
 * Admin only.
 */
onboardingMethodRouter.post('/:id/org-types', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = LinkOrgTypeSchema.parse(req.body);
        const result = await onboardingMethodService.linkToOrgType(ctx.tenantId, req.params.id, data.organizationTypeId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Unlink an organization type from this onboarding method.
 * DELETE /onboarding-methods/:id/org-types/:orgTypeId
 * Admin only.
 */
onboardingMethodRouter.delete('/:id/org-types/:orgTypeId', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const result = await onboardingMethodService.unlinkOrgType(ctx.tenantId, req.params.id, req.params.orgTypeId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});
