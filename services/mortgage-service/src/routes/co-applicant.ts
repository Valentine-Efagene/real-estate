import { Router, Request, Response, NextFunction } from 'express';
import {
    successResponse,
    getAuthContext,
    isAdmin,
    requireTenant,
} from '@valentine-efagene/qshelter-common';
import { getTenantPrisma } from '../lib/tenant-services';
import { createCoApplicantService } from '../services/co-applicant.service';
import {
    InviteCoApplicantSchema,
    UpdateCoApplicantSchema,
    RemoveCoApplicantSchema,
} from '../validators/co-applicant.validator';
import { createApplicationService } from '../services/application.service';
import { z } from 'zod';

const router: Router = Router({ mergeParams: true });

function getService(req: Request) {
    return createCoApplicantService(getTenantPrisma(req));
}

/**
 * GET /applications/:id/co-applicants
 * List all co-applicants on an application.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: applicationId } = req.params;
        const { userId, roles } = getAuthContext(req);

        // Admins or the buyer can list co-applicants
        if (!isAdmin(roles)) {
            const appService = createApplicationService(getTenantPrisma(req));
            const application = await appService.getById(applicationId);
            if (application.buyerId !== userId) {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
        }

        const service = getService(req);
        const coApplicants = await service.list(applicationId);
        res.json(successResponse(coApplicants));
    } catch (error) {
        next(error);
    }
});

/**
 * POST /applications/:id/co-applicants
 * Invite a co-applicant to an application.
 * Only the primary buyer or an admin can invite.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: applicationId } = req.params;
        const { userId, roles, tenantId } = getAuthContext(req);

        if (!isAdmin(roles)) {
            const appService = createApplicationService(getTenantPrisma(req));
            const application = await appService.getById(applicationId);
            if (application.buyerId !== userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Only the primary applicant or an admin can invite co-applicants',
                });
            }
        }

        const data = InviteCoApplicantSchema.parse(req.body);
        const service = getService(req);
        const coApplicant = await service.invite(applicationId, data, tenantId);
        res.status(201).json(successResponse(coApplicant));
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /applications/:id/co-applicants/:coApplicantId
 * Update co-applicant details.
 */
router.patch('/:coApplicantId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: applicationId, coApplicantId } = req.params;
        const { userId, roles } = getAuthContext(req);

        if (!isAdmin(roles)) {
            const appService = createApplicationService(getTenantPrisma(req));
            const application = await appService.getById(applicationId);
            if (application.buyerId !== userId) {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
        }

        const data = UpdateCoApplicantSchema.parse(req.body);
        const service = getService(req);
        const updated = await service.update(applicationId, coApplicantId, data);
        res.json(successResponse(updated));
    } catch (error) {
        next(error);
    }
});

/**
 * POST /applications/:id/co-applicants/:coApplicantId/accept
 * Co-applicant accepts their invitation (self-service).
 */
router.post('/:coApplicantId/accept', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: applicationId, coApplicantId } = req.params;
        const { userId } = getAuthContext(req);

        const service = getService(req);
        const updated = await service.accept(applicationId, coApplicantId, userId);
        res.json(successResponse(updated));
    } catch (error) {
        next(error);
    }
});

/**
 * POST /applications/:id/co-applicants/:coApplicantId/decline
 * Co-applicant declines their invitation.
 */
router.post('/:coApplicantId/decline', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: applicationId, coApplicantId } = req.params;
        const service = getService(req);
        const updated = await service.decline(applicationId, coApplicantId);
        res.json(successResponse(updated));
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /applications/:id/co-applicants/:coApplicantId
 * Remove a co-applicant (admin or primary buyer).
 */
router.delete('/:coApplicantId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: applicationId, coApplicantId } = req.params;
        const { userId, roles } = getAuthContext(req);

        if (!isAdmin(roles)) {
            const appService = createApplicationService(getTenantPrisma(req));
            const application = await appService.getById(applicationId);
            if (application.buyerId !== userId) {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
        }

        const data = RemoveCoApplicantSchema.parse(req.body ?? {});
        const service = getService(req);
        const updated = await service.remove(applicationId, coApplicantId, userId, data);
        res.json(successResponse(updated));
    } catch (error) {
        next(error);
    }
});

/**
 * POST /co-applicant-invites/accept-by-token
 * Accept a co-applicant invitation by token (for new users or existing users following an email link).
 * This route is mounted separately on /co-applicant-invites, not under /applications/:id.
 */
export const AcceptByTokenSchema = z.object({ token: z.string().min(1) });

export const acceptByTokenRouter: Router = Router();

acceptByTokenRouter.post('/accept-by-token', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { token } = AcceptByTokenSchema.parse(req.body);
        const service = createCoApplicantService(getTenantPrisma(req));
        const result = await service.acceptByToken(token, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

export default router;
