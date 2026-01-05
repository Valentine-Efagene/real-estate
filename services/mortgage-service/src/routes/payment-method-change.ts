import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { paymentMethodChangeService } from '../services/payment-method-change.service';
import { AppError, getAuthContext } from '@valentine-efagene/qshelter-common';

const router = Router();

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
// Customer Routes (nested under /contracts/:contractId)
// =============================================================================

/**
 * POST /contracts/:contractId/payment-method-change-requests
 * Create a new payment method change request
 */
router.post(
    '/contracts/:contractId/payment-method-change-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            const { contractId } = req.params;

            const body = createRequestSchema.parse(req.body);

            const request = await paymentMethodChangeService.createRequest({
                contractId,
                toPaymentMethodId: body.toPaymentMethodId,
                reason: body.reason,
                requestorId: userId,
                tenantId,
            });

            res.status(201).json(request);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /contracts/:contractId/payment-method-change-requests
 * List change requests for a contract
 */
router.get(
    '/contracts/:contractId/payment-method-change-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const { contractId } = req.params;

            const requests = await paymentMethodChangeService.listByContract(contractId, tenantId);

            res.json(requests);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /contracts/:contractId/payment-method-change-requests/:requestId
 * Get a specific change request
 */
router.get(
    '/contracts/:contractId/payment-method-change-requests/:requestId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const { requestId } = req.params;

            const request = await paymentMethodChangeService.findById(requestId, tenantId);

            res.json(request);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /contracts/:contractId/payment-method-change-requests/:requestId/submit-documents
 * Mark documents as submitted (moves to review queue)
 */
router.post(
    '/contracts/:contractId/payment-method-change-requests/:requestId/submit-documents',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const { requestId } = req.params;

            const request = await paymentMethodChangeService.submitDocuments(requestId, tenantId);

            res.json(request);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /contracts/:contractId/payment-method-change-requests/:requestId/cancel
 * Cancel a pending request (requestor only)
 */
router.post(
    '/contracts/:contractId/payment-method-change-requests/:requestId/cancel',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            if (!tenantId || !userId) {
                throw new AppError(400, 'Missing tenant or user context');
            }
            const { requestId } = req.params;

            const request = await paymentMethodChangeService.cancel(requestId, userId, tenantId);

            res.json(request);
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

            res.json(requests);
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
            const { requestId } = req.params;

            const request = await paymentMethodChangeService.startReview(requestId, userId, tenantId);

            res.json(request);
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
            const { requestId } = req.params;

            const body = reviewSchema.parse(req.body);

            const request = await paymentMethodChangeService.approve(
                requestId,
                userId,
                body.reviewNotes,
                tenantId
            );

            res.json(request);
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
            const { requestId } = req.params;

            const body = rejectSchema.parse(req.body);

            const request = await paymentMethodChangeService.reject(
                requestId,
                userId,
                body.rejectionReason,
                tenantId
            );

            res.json(request);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /payment-method-change-requests/:requestId/execute
 * Execute an approved change request (admin)
 * This performs the actual contract modification.
 */
router.post(
    '/payment-method-change-requests/:requestId/execute',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            if (!tenantId || !userId) {
                throw new AppError(400, 'Missing tenant or user context');
            }
            const { requestId } = req.params;

            const result = await paymentMethodChangeService.execute(requestId, userId, tenantId);

            res.json({
                message: 'Payment method change executed successfully',
                request: result.request,
                newPhases: result.newPhases,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
