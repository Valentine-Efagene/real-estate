import { Router, Request, Response, NextFunction } from 'express';
import { AppError, getAuthContext } from '@valentine-efagene/qshelter-common';
import {
    RequestTerminationSchema,
    AdminTerminationSchema,
    ReviewTerminationSchema,
    ProcessRefundSchema,
    CompleteRefundSchema,
    CancelTerminationSchema,
} from '../validators/application-termination.validator';
import { createApplicationTerminationService } from '../services/application-termination.service';
import { z } from 'zod';

const terminationRouter = Router();

/**
 * Request termination (buyer/seller initiated)
 * POST /applications/:applicationId/terminate
 */
terminationRouter.post(
    '/applications/:applicationId/terminate',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const applicationId = req.params.applicationId as string;
            const { userId } = getAuthContext(req);

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const validationResult = RequestTerminationSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationResult.error.issues
                });
            }

            const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
            const terminationService = createApplicationTerminationService();

            const termination = await terminationService.requestTermination(
                applicationId,
                userId,
                validationResult.data,
                { idempotencyKey }
            );

            res.status(201).json({
                success: true,
                data: termination,
                message:
                    termination.status === 'COMPLETED'
                        ? 'Application terminated successfully'
                        : 'Termination request submitted for review',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Admin-initiated termination
 * POST /applications/:applicationId/admin-terminate
 */
terminationRouter.post(
    '/applications/:applicationId/admin-terminate',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const applicationId = req.params.applicationId as string;
            const { userId } = getAuthContext(req);

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const validationResult = AdminTerminationSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationResult.error.issues
                });
            }

            const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
            const terminationService = createApplicationTerminationService();

            const termination = await terminationService.adminTerminate(
                applicationId,
                userId,
                validationResult.data,
                { idempotencyKey }
            );

            res.status(201).json({
                success: true,
                data: termination,
                message: validationResult.data.bypassApproval
                    ? 'Application termination initiated'
                    : 'Termination submitted for review',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get pending terminations for review (admin)
 * GET /terminations/pending
 * Note: Must be before /:terminationId to avoid route conflict
 */
terminationRouter.get(
    '/terminations/pending',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId } = getAuthContext(req);

            if (!tenantId) {
                return res.status(400).json({ error: 'Tenant context required' });
            }

            const terminationService = createApplicationTerminationService();
            const terminations = await terminationService.findPendingReview(tenantId);

            res.json({
                success: true,
                data: terminations,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get termination details
 * GET /terminations/:terminationId
 */
terminationRouter.get(
    '/terminations/:terminationId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const terminationId = req.params.terminationId as string;
            const terminationService = createApplicationTerminationService();

            const termination = await terminationService.findById(terminationId);

            res.json({
                success: true,
                data: termination,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get terminations for an application
 * GET /applications/:applicationId/terminations
 */
terminationRouter.get(
    '/applications/:applicationId/terminations',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const applicationId = req.params.applicationId as string;
            const terminationService = createApplicationTerminationService();

            const terminations = await terminationService.findByApplication(applicationId);

            res.json({
                success: true,
                data: terminations,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Review termination request (approve/reject)
 * POST /terminations/:terminationId/review
 */
terminationRouter.post(
    '/terminations/:terminationId/review',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const terminationId = req.params.terminationId as string;
            const { userId } = getAuthContext(req);

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const validationResult = ReviewTerminationSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationResult.error.issues
                });
            }

            const terminationService = createApplicationTerminationService();

            const termination = await terminationService.reviewTermination(
                terminationId,
                userId,
                validationResult.data
            );

            res.json({
                success: true,
                data: termination,
                message:
                    validationResult.data.decision === 'APPROVE'
                        ? 'Termination approved'
                        : 'Termination rejected',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Initiate refund processing
 * POST /terminations/:terminationId/refund
 */
terminationRouter.post(
    '/terminations/:terminationId/refund',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const terminationId = req.params.terminationId as string;
            const { userId } = getAuthContext(req);

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const validationResult = ProcessRefundSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationResult.error.issues
                });
            }

            const terminationService = createApplicationTerminationService();

            const termination = await terminationService.processRefund(
                terminationId,
                userId,
                validationResult.data
            );

            res.json({
                success: true,
                data: termination,
                message: 'Refund processing initiated',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Complete refund (after gateway confirmation)
 * POST /terminations/:terminationId/refund/complete
 */
terminationRouter.post(
    '/terminations/:terminationId/refund/complete',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const terminationId = req.params.terminationId as string;
            const { userId } = getAuthContext(req);

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const validationResult = CompleteRefundSchema.safeParse(req.body);
            if (!validationResult.success) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationResult.error.issues
                });
            }

            const terminationService = createApplicationTerminationService();

            const termination = await terminationService.completeRefund(
                terminationId,
                userId,
                validationResult.data
            );

            res.json({
                success: true,
                data: termination,
                message: 'Refund completed and application terminated',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Cancel termination request
 * POST /terminations/:terminationId/cancel
 */
terminationRouter.post(
    '/terminations/:terminationId/cancel',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const terminationId = req.params.terminationId as string;
            const { userId } = getAuthContext(req);

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            let data;
            if (req.body && Object.keys(req.body).length > 0) {
                const validationResult = CancelTerminationSchema.safeParse(req.body);
                if (!validationResult.success) {
                    return res.status(400).json({
                        error: 'Validation failed',
                        details: validationResult.error.issues
                    });
                }
                data = validationResult.data;
            }

            const terminationService = createApplicationTerminationService();

            const termination = await terminationService.cancelTermination(terminationId, userId, data);

            res.json({
                success: true,
                data: termination,
                message: 'Termination request cancelled',
            });
        } catch (error) {
            next(error);
        }
    }
);

export default terminationRouter;
