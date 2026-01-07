import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { propertyTransferService } from '../services/property-transfer.service';
import { AppError, getAuthContext } from '@valentine-efagene/qshelter-common';

const router = Router();

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
// Customer Routes (nested under /contracts/:contractId)
// =============================================================================

/**
 * POST /contracts/:contractId/transfer-requests
 * Create a new property transfer request
 */
router.post(
    '/contracts/:contractId/transfer-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, userId } = getAuthContext(req);
            const { contractId } = req.params;

            const body = createRequestSchema.parse(req.body);

            const request = await propertyTransferService.createRequest({
                sourceContractId: contractId,
                targetPropertyUnitId: body.targetPropertyUnitId,
                reason: body.reason,
                requestedById: userId,
                tenantId,
            });

            res.status(201).json(request);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /contracts/:contractId/transfer-requests
 * List transfer requests for a contract
 */
router.get(
    '/contracts/:contractId/transfer-requests',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);
            if (!tenantId) {
                throw new AppError(400, 'Missing tenant context');
            }
            const { contractId } = req.params;

            const requests = await propertyTransferService.listByContract(contractId, tenantId);

            res.json(requests);
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

            res.json(requests);
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
            const { requestId } = req.params;

            const request = await propertyTransferService.getById(requestId, tenantId);

            res.json(request);
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
            const { requestId } = req.params;

            const body = approveSchema.parse(req.body);

            const result = await propertyTransferService.approve({
                requestId,
                reviewerId: userId,
                reviewNotes: body.reviewNotes,
                priceAdjustmentHandling: body.priceAdjustmentHandling,
                tenantId,
            });

            res.json({
                message: 'Transfer approved successfully',
                request: result.request,
                newContract: {
                    id: result.newContract.id,
                    contractNumber: result.newContract.contractNumber,
                    status: result.newContract.status,
                },
                paymentsMigrated: result.paymentsMigrated,
            });
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
            const { requestId } = req.params;

            const body = rejectSchema.parse(req.body);

            const request = await propertyTransferService.reject({
                requestId,
                reviewerId: userId,
                reason: body.reason,
                tenantId,
            });

            res.json({
                message: 'Transfer request rejected',
                request,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
