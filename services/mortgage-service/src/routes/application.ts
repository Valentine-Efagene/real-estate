import { Router, Request, Response, NextFunction } from 'express';
import { createApplicationService } from '../services/application.service';
import { applicationPhaseService } from '../services/application-phase.service';
import { applicationPaymentService } from '../services/application-payment.service';
import {
    ApplicationStatus,
    successResponse,
    getAuthContext,
    requireTenant,
    requireRole,
    isAdmin,
    ADMIN_ROLES,
} from '@valentine-efagene/qshelter-common';
import {
    CreateApplicationSchema,
    UpdateApplicationSchema,
    TransitionApplicationSchema,
} from '../validators/application.validator';
import {
    ActivatePhaseSchema,
    CompleteStepSchema,
    UploadDocumentSchema,
    GenerateInstallmentsSchema,
    ApproveDocumentSchema,
} from '../validators/application-phase.validator';
import {
    CreatePaymentSchema,
    ProcessPaymentSchema,
    RefundPaymentSchema,
} from '../validators/application-payment.validator';
import { z } from 'zod';
import { getTenantPrisma } from '../lib/tenant-services';
import { AppError } from '@valentine-efagene/qshelter-common';

const router = Router();

/**
 * Helper to get tenant-scoped application service from request
 */
function getApplicationService(req: Request) {
    return createApplicationService(getTenantPrisma(req));
}

/**
 * Middleware to verify user can access an application.
 * Admins can access any application in their tenant.
 * Customers can only access their own applications.
 */
async function canAccessApplication(req: Request, res: Response, next: NextFunction) {
    try {
        const { userId, roles } = getAuthContext(req);
        const applicationId = req.params.id as string;

        // Admins can access any application
        if (isAdmin(roles)) {
            return next();
        }

        // For customers, check ownership
        const applicationService = getApplicationService(req);
        const application = await applicationService.findById(applicationId);

        if (application.buyerId !== userId) {
            throw new AppError(403, 'You do not have permission to access this application');
        }

        next();
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// APPLICATION ROUTES
// ============================================================================

// Create application from payment method
router.post('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId, userId } = getAuthContext(req);
        const data = CreateApplicationSchema.parse(req.body);
        // Use userId from header as buyerId if not provided in body
        const applicationData = { ...data, tenantId, buyerId: data.buyerId || userId };
        const applicationService = getApplicationService(req);
        const application = await applicationService.create(applicationData);
        res.status(201).json(successResponse(application));
    } catch (error: any) {
        console.error('Application create error:', error.message);
        if (error instanceof z.ZodError) {
            console.error('Zod validation error:', JSON.stringify(error.issues, null, 2));
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all applications
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { buyerId, propertyUnitId, status } = req.query;
        const { userId, roles } = getAuthContext(req);
        const applicationService = getApplicationService(req);

        // Non-admins can only see their own applications
        const filters: any = {
            propertyUnitId: propertyUnitId as string,
            status: status as ApplicationStatus | undefined,
        };

        if (isAdmin(roles)) {
            // Admins can filter by any buyerId
            filters.buyerId = buyerId as string;
        } else {
            // Customers can only see their own
            filters.buyerId = userId;
        }

        const applications = await applicationService.findAll(filters);
        res.json(successResponse(applications));
    } catch (error) {
        next(error);
    }
});

// Get application by ID
router.get('/:id', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicationService = getApplicationService(req);
        const application = await applicationService.findById(req.params.id as string);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Get current action required for an application
// This is the canonical endpoint for the app to know what to show the user
router.get('/:id/current-action', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicationService = getApplicationService(req);
        const result = await applicationService.getCurrentAction(req.params.id as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Get application by application number
router.get('/number/:applicationNumber', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicationService = getApplicationService(req);
        const application = await applicationService.findByApplicationNumber(req.params.applicationNumber as string);

        // Check access - admins can access any, customers only their own
        const { userId, roles } = getAuthContext(req);
        if (!isAdmin(roles) && application.buyerId !== userId) {
            throw new AppError(403, 'You do not have permission to access this application');
        }

        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Update application
router.patch('/:id', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateApplicationSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const application = await applicationService.update(req.params.id as string, data, userId);
        res.json(successResponse(application));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Transition application state
router.post('/:id/transition', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = TransitionApplicationSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const application = await applicationService.transition(req.params.id as string, data, userId);
        res.json(successResponse(application));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Sign application
router.post('/:id/sign', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const application = await applicationService.sign(req.params.id as string, userId);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Cancel application
router.post('/:id/cancel', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { reason } = req.body;
        const applicationService = getApplicationService(req);
        const application = await applicationService.cancel(req.params.id as string, userId, reason);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Delete application (draft only)
router.delete('/:id', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const result = await applicationService.delete(req.params.id as string, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// PHASE ROUTES
// ============================================================================

// Get phases for an application
router.get('/:id/phases', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phases = await applicationPhaseService.getPhasesByApplication(req.params.id as string);
        // Flatten payment phase fields for backwards compatibility
        const flattenedPhases = phases.map((phase: any) => ({
            ...phase,
            // Flatten PaymentPhase fields to top level
            totalAmount: phase.paymentPhase?.totalAmount ?? 0,
            paidAmount: phase.paymentPhase?.paidAmount ?? 0,
            interestRate: phase.paymentPhase?.interestRate ?? null,
            collectFunds: phase.paymentPhase?.collectFunds ?? false,
            installments: phase.paymentPhase?.installments ?? [],
            // Flatten DocumentationPhase fields
            currentStepId: phase.documentationPhase?.currentStepId ?? null,
            steps: phase.documentationPhase?.steps ?? [],
            // Flatten QuestionnairePhase fields
            fields: phase.questionnairePhase?.fields ?? [],
        }));
        res.json(successResponse(flattenedPhases));
    } catch (error) {
        next(error);
    }
});

// Get phase by ID
router.get('/:id/phases/:phaseId', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phase = await applicationPhaseService.findById(req.params.phaseId as string);
        // Flatten polymorphic fields for backwards compatibility
        const flattenedPhase = {
            ...phase,
            totalAmount: (phase as any).paymentPhase?.totalAmount ?? 0,
            paidAmount: (phase as any).paymentPhase?.paidAmount ?? 0,
            interestRate: (phase as any).paymentPhase?.interestRate ?? null,
            collectFunds: (phase as any).paymentPhase?.collectFunds ?? false,
            installments: (phase as any).paymentPhase?.installments ?? [],
            currentStepId: (phase as any).documentationPhase?.currentStepId ?? null,
            steps: (phase as any).documentationPhase?.steps ?? [],
            fields: (phase as any).questionnairePhase?.fields ?? [],
        };
        res.json(successResponse(flattenedPhase));
    } catch (error) {
        next(error);
    }
});

// Activate phase
router.post('/:id/phases/:phaseId/activate', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ActivatePhaseSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.activate(req.params.phaseId as string, data, userId);
        res.json(successResponse(phase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Generate installments for phase
router.post('/:id/phases/:phaseId/installments', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = GenerateInstallmentsSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.generateInstallments(req.params.phaseId as string, data, userId);
        // Transform installments to include amountDue for backwards compatibility
        // Installments are now on paymentPhase extension
        const installments = phase.paymentPhase?.installments ?? [];
        const responsePhase = {
            ...phase,
            installments: installments.map((inst: any) => ({
                ...inst,
                amountDue: inst.amount,
            })),
        };
        res.json(successResponse(responsePhase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Complete a step in a documentation phase
router.post('/:id/phases/:phaseId/steps/complete', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CompleteStepSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.completeStep(req.params.phaseId as string, data, userId);
        res.json(successResponse(phase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Reject a step in a documentation phase (admin action)
router.post('/:id/phases/:phaseId/steps/:stepId/reject', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ success: false, error: 'Rejection reason is required' });
            return;
        }
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.rejectStep(req.params.phaseId as string, req.params.stepId as string, reason, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Request changes on a step (admin action)
router.post('/:id/phases/:phaseId/steps/:stepId/request-changes', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ success: false, error: 'Change request reason is required' });
            return;
        }
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.requestStepChanges(req.params.phaseId as string, req.params.stepId as string, reason, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Get documents for a phase
router.get('/:id/phases/:phaseId/documents', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const documents = await applicationPhaseService.getDocumentsByPhase(req.params.phaseId as string);
        res.json(successResponse(documents));
    } catch (error) {
        next(error);
    }
});

// Get installments for a phase
router.get('/:id/phases/:phaseId/installments', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = req.query.status as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
        const installments = await applicationPhaseService.getInstallmentsByPhase(req.params.phaseId as string, { status, limit });
        res.json(successResponse(installments));
    } catch (error) {
        next(error);
    }
});

// Upload document for phase
router.post('/:id/phases/:phaseId/documents', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UploadDocumentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const document = await applicationPhaseService.uploadDocument(req.params.phaseId as string, data, userId);
        res.status(201).json(successResponse(document));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Review/approve a document (admin only)
router.post('/:id/documents/:documentId/review', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ApproveDocumentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const document = await applicationPhaseService.approveDocument(req.params.documentId as string, data, userId);
        res.json(successResponse(document));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Complete phase
router.post('/:id/phases/:phaseId/complete', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.complete(req.params.phaseId as string, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Skip phase (admin only)
router.post('/:id/phases/:phaseId/skip', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { reason } = req.body;
        const phase = await applicationPhaseService.skip(req.params.phaseId as string, userId, reason);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// PAYMENT ROUTES
// ============================================================================

// Create payment
router.post('/:id/payments', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CreatePaymentSchema.parse({
            ...req.body,
            applicationId: req.params.id as string,
        });
        const { userId } = getAuthContext(req);
        const payment = await applicationPaymentService.create(data, userId);
        res.status(201).json(successResponse(payment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get payments for application
router.get('/:id/payments', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payments = await applicationPaymentService.findByApplication(req.params.id as string);
        res.json(successResponse(payments));
    } catch (error) {
        next(error);
    }
});

// Get payment by ID
router.get('/:id/payments/:paymentId', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payment = await applicationPaymentService.findById(req.params.paymentId as string);
        res.json(successResponse(payment));
    } catch (error) {
        next(error);
    }
});

// Process payment (webhook callback)
router.post('/payments/process', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ProcessPaymentSchema.parse(req.body);
        const payment = await applicationPaymentService.process(data);
        res.json(successResponse(payment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Refund payment (admin only)
router.post('/:id/payments/:paymentId/refund', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = RefundPaymentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const payment = await applicationPaymentService.refund(req.params.paymentId as string, data, userId);
        res.json(successResponse(payment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Pay ahead (apply excess to future installments)
router.post('/:id/pay-ahead', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { amount } = req.body;
        if (typeof amount !== 'number' || amount <= 0) {
            res.status(400).json({ success: false, error: 'amount must be a positive number' });
            return;
        }
        const { userId } = getAuthContext(req);
        const result = await applicationPaymentService.payAhead(req.params.id as string, amount, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

export default router;
