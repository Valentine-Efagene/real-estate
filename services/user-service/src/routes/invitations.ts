import { Router } from 'express';
import {
    successResponse,
    getAuthContext,
    isAdmin,
} from '@valentine-efagene/qshelter-common';
import { invitationService } from '../services/invitation.service';
import { z } from 'zod';

export const invitationRouter = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateInvitationSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    roleId: z.string().min(1).openapi({ description: 'Role to assign to the invited user. Required.' }),
    title: z.string().optional(),
    department: z.string().optional(),
    expiresInDays: z.number().int().min(1).max(30).optional().openapi({ description: 'Days until invitation expires. Default: 7' }),
    isOnboarder: z.boolean().optional().openapi({ description: 'Whether this invitee becomes the organization onboarder. Default: false' }),
});

const AcceptInvitationSchema = z.object({
    password: z.string().min(8).max(128),
    phone: z.string().optional(),
});

const ListInvitationsQuerySchema = z.object({
    page: z.string().optional().transform((val) => (val ? Number(val) : undefined)),
    limit: z.string().optional().transform((val) => (val ? Number(val) : undefined)),
    status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).optional(),
});

// =============================================================================
// ORGANIZATION INVITATION ROUTES (Authenticated)
// =============================================================================

/**
 * Create and send an invitation to join an organization.
 * POST /organizations/:id/invitations
 * Admin only.
 */
invitationRouter.post('/organizations/:id/invitations', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const data = CreateInvitationSchema.parse(req.body);
        const result = await invitationService.createInvitation(ctx.tenantId, ctx.userId, {
            organizationId: req.params.id,
            ...data,
        });
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * List invitations for an organization.
 * GET /organizations/:id/invitations
 * Admin only.
 */
invitationRouter.get('/organizations/:id/invitations', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const params = ListInvitationsQuerySchema.parse(req.query);
        const result = await invitationService.listInvitations(ctx.tenantId, req.params.id, params);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Cancel a pending invitation.
 * DELETE /invitations/:id
 * Admin only.
 */
invitationRouter.delete('/invitations/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        await invitationService.cancelInvitation(ctx.tenantId, req.params.id, ctx.userId);
        res.json(successResponse({ message: 'Invitation cancelled successfully' }));
    } catch (error) {
        next(error);
    }
});

/**
 * Resend an invitation email.
 * POST /invitations/:id/resend
 * Admin only.
 */
invitationRouter.post('/invitations/:id/resend', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!isAdmin(ctx.roles, ctx)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const result = await invitationService.resendInvitation(ctx.tenantId, req.params.id, ctx.userId);
        res.json(successResponse({ message: 'Invitation resent successfully', invitation: result }));
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// PUBLIC INVITATION ROUTES (No Auth Required)
// These routes are mounted separately to bypass the authorizer
// =============================================================================

export const publicInvitationRouter = Router();

/**
 * Get invitation details by token.
 * GET /invitations/accept?token=xxx
 * Public - used to show invitation details on the accept page.
 */
publicInvitationRouter.get('/invitations/accept', async (req, res, next) => {
    try {
        const token = req.query.token as string;
        if (!token) {
            return res.status(400).json({ success: false, error: 'Token is required' });
        }

        const result = await invitationService.getInvitationByToken(token);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Accept an invitation and create account.
 * POST /invitations/accept
 * Public - invitee uses this to accept and set their password.
 * Returns auth tokens so the user is automatically logged in.
 */
publicInvitationRouter.post('/invitations/accept', async (req, res, next) => {
    try {
        const token = req.query.token as string;
        if (!token) {
            return res.status(400).json({ success: false, error: 'Token is required' });
        }

        const data = AcceptInvitationSchema.parse(req.body);
        const result = await invitationService.acceptInvitation(token, data.password, {
            phone: data.phone,
        });

        res.json(
            successResponse({
                message: 'Invitation accepted successfully',
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    firstName: result.user.firstName,
                    lastName: result.user.lastName,
                },
                organization: result.organization,
                // Include auth tokens for automatic login
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn,
            })
        );
    } catch (error) {
        next(error);
    }
});
