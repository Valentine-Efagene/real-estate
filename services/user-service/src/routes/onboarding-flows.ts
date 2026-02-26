import { Router } from 'express';
import {
    successResponse,
    getAuthContext,
    isAdmin,
} from '@valentine-efagene/qshelter-common';
import { onboardingFlowService } from '../services/onboarding-flow.service';
import { z } from 'zod';

export const onboardingFlowRouter = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateFlowSchema = z.object({
    name: z.string().min(2).max(200),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    autoActivatePhases: z.boolean().optional(),
    expiresInDays: z.number().int().positive().nullable().optional(),
});

const UpdateFlowSchema = z.object({
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
    order: z.number().int().positive(),
    requiresPreviousPhaseCompletion: z.boolean().optional(),
    questionnairePlanId: z.string().optional(),
    documentationPlanId: z.string().optional(),
    gatePlanId: z.string().optional(),
});

const UpdatePhaseSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().optional(),
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
 * List available plans and org types for building onboarding flows.
 * GET /onboarding-flows/reference/plans
 */
onboardingFlowRouter.get('/reference/plans', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const [questionnairePlans, documentationPlans, gatePlans, orgTypes] = await Promise.all([
            onboardingFlowService.listQuestionnairePlans(ctx.tenantId),
            onboardingFlowService.listDocumentationPlans(ctx.tenantId),
            onboardingFlowService.listGatePlans(ctx.tenantId),
            onboardingFlowService.listOrgTypes(ctx.tenantId),
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
 * List all onboarding flows.
 * GET /onboarding-flows
 */
onboardingFlowRouter.get('/', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const result = await onboardingFlowService.list(ctx.tenantId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Get onboarding flow by ID.
 * GET /onboarding-flows/:id
 */
onboardingFlowRouter.get('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const result = await onboardingFlowService.findById(ctx.tenantId, req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Create a new onboarding flow.
 * POST /onboarding-flows
 * Admin only.
 */
onboardingFlowRouter.post('/', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = CreateFlowSchema.parse(req.body);
        const result = await onboardingFlowService.create(ctx.tenantId, data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Update an onboarding flow.
 * PATCH /onboarding-flows/:id
 * Admin only.
 */
onboardingFlowRouter.patch('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = UpdateFlowSchema.parse(req.body);
        const result = await onboardingFlowService.update(ctx.tenantId, req.params.id, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Delete an onboarding flow.
 * DELETE /onboarding-flows/:id
 * Admin only.
 */
onboardingFlowRouter.delete('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const result = await onboardingFlowService.delete(ctx.tenantId, req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// PHASE ROUTES
// =============================================================================

/**
 * Add a phase to an onboarding flow.
 * POST /onboarding-flows/:id/phases
 * Admin only.
 */
onboardingFlowRouter.post('/:id/phases', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = AddPhaseSchema.parse(req.body);
        const result = await onboardingFlowService.addPhase(ctx.tenantId, req.params.id, data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Update a phase.
 * PATCH /onboarding-flows/:id/phases/:phaseId
 * Admin only.
 */
onboardingFlowRouter.patch('/:id/phases/:phaseId', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = UpdatePhaseSchema.parse(req.body);
        const result = await onboardingFlowService.updatePhase(ctx.tenantId, req.params.id, req.params.phaseId, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Remove a phase.
 * DELETE /onboarding-flows/:id/phases/:phaseId
 * Admin only.
 */
onboardingFlowRouter.delete('/:id/phases/:phaseId', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const result = await onboardingFlowService.removePhase(ctx.tenantId, req.params.id, req.params.phaseId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// ORG TYPE LINKING
// =============================================================================

/**
 * Link an onboarding flow to an organization type.
 * POST /onboarding-flows/:id/org-types
 * Admin only.
 */
onboardingFlowRouter.post('/:id/org-types', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const data = LinkOrgTypeSchema.parse(req.body);
        const result = await onboardingFlowService.linkToOrgType(ctx.tenantId, req.params.id, data.organizationTypeId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Unlink an organization type from this onboarding flow.
 * DELETE /onboarding-flows/:id/org-types/:orgTypeId
 * Admin only.
 */
onboardingFlowRouter.delete('/:id/org-types/:orgTypeId', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const result = await onboardingFlowService.unlinkOrgType(ctx.tenantId, req.params.id, req.params.orgTypeId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});
