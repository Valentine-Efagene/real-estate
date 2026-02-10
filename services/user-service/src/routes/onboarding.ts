import { Router } from 'express';
import {
    successResponse,
    getAuthContext,
    hasAnyRole,
    ADMIN_ROLES,
} from '@valentine-efagene/qshelter-common';
import { onboardingService } from '../services/onboarding.service';
import { z } from 'zod';

export const onboardingRouter = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const SubmitQuestionnaireFieldsSchema = z.object({
    fields: z.array(z.object({
        fieldId: z.string().min(1),
        value: z.any(),
    })).min(1),
});

const ReviewGateSchema = z.object({
    decision: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
    notes: z.string().optional(),
});

const ReassignOnboarderSchema = z.object({
    newAssigneeId: z.string().min(1),
});

// =============================================================================
// ONBOARDING ROUTES
// =============================================================================
// All routes are nested under /organizations/:id/onboarding
// =============================================================================

/**
 * Get organization onboarding status.
 * GET /organizations/:id/onboarding
 */
onboardingRouter.get('/organizations/:id/onboarding', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const result = await onboardingService.getOnboarding(ctx.tenantId, req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Start an onboarding workflow (when assignee is already set).
 * POST /organizations/:id/onboarding/start
 * Admin or assignee.
 */
onboardingRouter.post('/organizations/:id/onboarding/start', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const result = await onboardingService.startOnboarding(ctx.tenantId, req.params.id, ctx.userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Submit questionnaire fields for an onboarding phase.
 * POST /organizations/:id/onboarding/phases/:phaseId/questionnaire
 */
onboardingRouter.post('/organizations/:id/onboarding/phases/:phaseId/questionnaire', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const data = SubmitQuestionnaireFieldsSchema.parse(req.body);
        const result = await onboardingService.submitQuestionnaireFields(
            ctx.tenantId,
            req.params.id,
            req.params.phaseId,
            data,
        );
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Review a gate phase (approve/reject).
 * POST /organizations/:id/onboarding/phases/:phaseId/gate/review
 * Admin only (platform reviewer).
 */
onboardingRouter.post('/organizations/:id/onboarding/phases/:phaseId/gate/review', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const data = ReviewGateSchema.parse(req.body);
        const result = await onboardingService.reviewGatePhase(
            ctx.tenantId,
            req.params.id,
            req.params.phaseId,
            ctx.userId,
            data,
        );
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Reassign the onboarder to a different user.
 * PATCH /organizations/:id/onboarding/reassign
 * Admin only.
 */
onboardingRouter.patch('/organizations/:id/onboarding/reassign', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const data = ReassignOnboarderSchema.parse(req.body);
        const result = await onboardingService.reassignOnboarder(
            ctx.tenantId,
            req.params.id,
            data.newAssigneeId,
            ctx.userId,
        );
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});
