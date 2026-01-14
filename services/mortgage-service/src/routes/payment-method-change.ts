import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { paymentMethodChangeService } from '../services/payment-method-change.service';
import { AppError, getAuthContext, successResponse } from '@valentine-efagene/qshelter-common';

const router: Router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const createRequestSchema = z.object({
    toPaymentMethodId: z.string().min(1, 'New payment method ID is required'),
    reason: z.string().optional(),
});

const reviewSchema = z.object({
    reviewNotes: z.string().optional(),
});

const rejectSchema = z.object({
    rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

// =============================================================================
// Customer Routes (nested under /applications/:applicationId)
// =============================================================================

/**
 * POST /applications/:applicationId/payment-method-change-requests
 * Create a new payment method change request
 */
router.post(
    '/applications/:applicationId/payment-method-change-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            const applicationId = req.params.applicationId as string;

            const body = createRequestSchema.parse(req.body);

            const request = await paymentMethodChangeService.createRequest({
                applicationId,
                toPaymentMethodId: body.toPaymentMethodId,
                reason: body.reason,
                requestorId: userId,
                tenantId,
            });

            res.status(201).json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /applications/:applicationId/payment-method-change-requests
 * List change requests for a application
 */
router.get(
    '/applications/:applicationId/payment-method-change-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const applicationId = req.params.applicationId as string;

            const requests = await paymentMethodChangeService.listByapplication(applicationId, tenantId);

            res.json(successResponse(requests));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /applications/:applicationId/payment-method-change-requests/:requestId
 * Get a specific change request
 */
router.get(
    '/applications/:applicationId/payment-method-change-requests/:requestId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const requestId = req.params.requestId as string;

            const request = await paymentMethodChangeService.findById(requestId, tenantId);

            res.json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /applications/:applicationId/payment-method-change-requests/:requestId/submit-documents
 * Mark documents as submitted (moves to review queue)
 */
router.post(
    '/applications/:applicationId/payment-method-change-requests/:requestId/submit-documents',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const requestId = req.params.requestId as string;

            const request = await paymentMethodChangeService.submitDocuments(requestId, tenantId);

            res.json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /applications/:applicationId/payment-method-change-requests/:requestId/cancel
 * Cancel a pending request (requestor only)
 */
router.post(
    '/applications/:applicationId/payment-method-change-requests/:requestId/cancel',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            if (!tenantId || !userId) {
                throw new AppError(400, 'Missing tenant or user context');
            }
            const requestId = req.params.requestId as string;

            const request = await paymentMethodChangeService.cancel(requestId, userId, tenantId);

            res.json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

// =============================================================================
// Admin Routes
// =============================================================================

/**
 * GET /payment-method-change-requests
 * List all pending requests for admin review
 */
router.get(
    '/payment-method-change-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }

            const requests = await paymentMethodChangeService.listPendingForReview(tenantId);

            res.json(successResponse(requests));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /payment-method-change-requests/:requestId/start-review
 * Start review of a request (admin)
 */
router.post(
    '/payment-method-change-requests/:requestId/start-review',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            if (!tenantId || !userId) {
                throw new AppError(400, 'Missing tenant or user context');
            }
            const requestId = req.params.requestId as string;

            const request = await paymentMethodChangeService.startReview(requestId, userId, tenantId);

            res.json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /payment-method-change-requests/:requestId/approve
 * Approve a change request (admin)
 */
router.post(
    '/payment-method-change-requests/:requestId/approve',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            if (!tenantId || !userId) {
                throw new AppError(400, 'Missing tenant or user context');
            }
            const requestId = req.params.requestId as string;

            const body = reviewSchema.parse(req.body);

            const request = await paymentMethodChangeService.approve(
                requestId,
                userId,
                body.reviewNotes,
                tenantId
            );

            res.json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /payment-method-change-requests/:requestId/reject
 * Reject a change request (admin)
 */
router.post(
    '/payment-method-change-requests/:requestId/reject',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            if (!tenantId || !userId) {
                throw new AppError(400, 'Missing tenant or user context');
            }
            const requestId = req.params.requestId as string;

            const body = rejectSchema.parse(req.body);

            const request = await paymentMethodChangeService.reject(
                requestId,
                userId,
                body.rejectionReason,
                tenantId
            );

            res.json(successResponse(request));
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /payment-method-change-requests/:requestId/execute
 * Execute an approved change request (admin)
 * This performs the actual application modification.
 */
router.post(
    '/payment-method-change-requests/:requestId/execute',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            if (!tenantId || !userId) {
                throw new AppError(400, 'Missing tenant or user context');
            }
            const requestId = req.params.requestId as string;

            const result = await paymentMethodChangeService.execute(requestId, userId, tenantId);

            res.json(successResponse({
                message: 'Payment method change executed successfully',
                request: result.request,
                newPhases: result.newPhases,
            }));
        } catch (error) {
            next(error);
        }
    }
);

export default router;
