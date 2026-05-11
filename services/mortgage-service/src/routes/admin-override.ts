import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    successResponse,
    getAuthContext,
    requireTenant,
    requirePlatformRole as requireRole,
    PLATFORM_ADMIN_ROLES as ADMIN_ROLES,
} from '@valentine-efagene/qshelter-common';
import { getTenantPrisma } from '../lib/tenant-services';
import { createAdminOverrideService } from '../services/admin-override.service';
import { CreateAdminDocumentOverrideSchema } from '../validators/admin-override.validator';

const router: Router = Router({ mergeParams: true });

/**
 * POST /applications/:applicationId/overrides
 * Create an admin document override for a specific application.
 * Replaces the deprecated org-level exclusion list (OrganizationDocumentWaiver).
 * Scope: application-wide, phase-specific, or document-specific.
 */
router.post('/', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId, userId } = getAuthContext(req);
        const data = CreateAdminDocumentOverrideSchema.parse({
            ...req.body,
            applicationId: req.params.applicationId,
        });
        const service = createAdminOverrideService(getTenantPrisma(req));
        const result = await service.createOverride(tenantId, userId, data);
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
 * GET /applications/:applicationId/overrides
 * List all admin document overrides for an application.
 */
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = createAdminOverrideService(getTenantPrisma(req));
        const result = await service.listOverrides(tenantId, req.params.applicationId as string);
        res.json(successResponse(result));
    } catch (error: any) {
        next(error);
    }
});

export default router;
