import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { propertyTransferService } from '../services/property-transfer.service';
import { AppError, getAuthContext, successResponse } from '@valentine-efagene/qshelter-common';

const router: Router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const createRequestSchema = z.object({
    targetPropertyUnitId: z.string().min(1, 'Target property unit ID is required'),
    reason: z.string().optional(),
});

const approveSchema = z.object({
    reviewNotes: z.string().optional(),
    priceAdjustmentHandling: z.enum(['ADD_TO_MORTGAGE', 'REQUIRE_PAYMENT', 'CREDIT_BUYER']).optional(),
});

const rejectSchema = z.object({
    reason: z.string().min(1, 'Rejection reason is required'),
});

// =============================================================================
// Customer Routes (nested under /applications/:applicationId)
// =============================================================================

/**
 * POST /applications/:applicationId/transfer-requests
 * Create a new property transfer request
 */
router.post(
    '/applications/:applicationId/transfer-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            const applicationId = req.params.applicationId as string;

            const body = createRequestSchema.parse(req.body);

            const request = await propertyTransferService.createRequest({
                sourceApplicationId: applicationId,
                targetPropertyUnitId: body.targetPropertyUnitId,
                reason: body.reason,
                requestedById: userId,
                tenantId,
            });

            res.status(201).json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /applications/:applicationId/transfer-requests
 * List transfer requests for a application
 */
router.get(
    '/applications/:applicationId/transfer-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const applicationId = req.params.applicationId as string;

            const requests = await propertyTransferService.listByapplication(applicationId, tenantId);

            res.json(successResponse(requests));
        } catch (error) {
            next(error);
        }
    }
);

// =============================================================================
// Admin Routes
// =============================================================================

/**
 * GET /transfer-requests
 * List all pending transfer requests (admin view)
 */
router.get(
    '/transfer-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }

            const requests = await propertyTransferService.listPending(tenantId);

            res.json(successResponse(requests));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /transfer-requests/:requestId
 * Get a transfer request by ID with full details
 */
router.get(
    '/transfer-requests/:requestId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const requestId = req.params.requestId as string;

            const request = await propertyTransferService.getById(requestId, tenantId);

            res.json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /transfer-requests/:requestId/approve
 * Approve a transfer request (admin only)
 */
router.patch(
    '/transfer-requests/:requestId/approve',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            const requestId = req.params.requestId as string;

            const body = approveSchema.parse(req.body);

            const result = await propertyTransferService.approve({
                requestId,
                reviewerId: userId,
                reviewNotes: body.reviewNotes,
                priceAdjustmentHandling: body.priceAdjustmentHandling,
                tenantId,
            });

            res.json(successResponse({
                message: 'Transfer approved successfully',
                request: result.request,
                newApplication: {
                    id: result.newApplication.id,
                    applicationNumber: result.newApplication.applicationNumber,
                    status: result.newApplication.status,
                },
                refundedAmount: result.refundedAmount,
            }));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /transfer-requests/:requestId/reject
 * Reject a transfer request (admin only)
 */
router.patch(
    '/transfer-requests/:requestId/reject',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            const requestId = req.params.requestId as string;

            const body = rejectSchema.parse(req.body);

            const request = await propertyTransferService.reject({
                requestId,
                reviewerId: userId,
                reason: body.reason,
                tenantId,
            });

            res.json(successResponse({
                message: 'Transfer request rejected',
                request,
            }));
        } catch (error) {
            next(error);
        }
    }
);

export default router;
