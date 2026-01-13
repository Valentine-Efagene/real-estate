import { Router, Request, Response, NextFunction } from 'express';
import { applicationService } from '../services/application.service';
import { applicationPhaseService } from '../services/application-phase.service';
import { applicationPaymentService } from '../services/application-payment.service';
import { ApplicationStatus, successResponse } from '@valentine-efagene/qshelter-common';
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
import { getAuthContext } from '@valentine-efagene/qshelter-common';

const router = Router();

// ============================================================================
// APPLICATION ROUTES
// ============================================================================

// Create application from payment method
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId, userId } = getAuthContext(req);
        const data = CreateApplicationSchema.parse(req.body);
        // Use userId from header as buyerId if not provided in body
        const applicationData = { ...data, tenantId, buyerId: data.buyerId || userId };
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
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { buyerId, propertyUnitId, status } = req.query;
        const applications = await applicationService.findAll({
            buyerId: buyerId as string,
            propertyUnitId: propertyUnitId as string,
            status: status as ApplicationStatus | undefined,
        });
        res.json(successResponse(applications));
    } catch (error) {
        next(error);
    }
});

// Get application by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const application = await applicationService.findById(req.params.id);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Get current action required for an application
// This is the canonical endpoint for the app to know what to show the user
router.get('/:id/current-action', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await applicationService.getCurrentAction(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Get application by application number
router.get('/number/:applicationNumber', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const application = await applicationService.findByApplicationNumber(req.params.applicationNumber);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Update application
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateApplicationSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const application = await applicationService.update(req.params.id, data, userId);
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
router.post('/:id/transition', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = TransitionApplicationSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const application = await applicationService.transition(req.params.id, data, userId);
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
router.post('/:id/sign', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const application = await applicationService.sign(req.params.id, userId);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Cancel application
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { reason } = req.body;
        const application = await applicationService.cancel(req.params.id, userId, reason);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Delete application (draft only)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const result = await applicationService.delete(req.params.id, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// PHASE ROUTES
// ============================================================================

// Get phases for an application
router.get('/:id/phases', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phases = await applicationPhaseService.getPhasesByApplication(req.params.id);
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
router.get('/:id/phases/:phaseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phase = await applicationPhaseService.findById(req.params.phaseId);
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
router.post('/:id/phases/:phaseId/activate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ActivatePhaseSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.activate(req.params.phaseId, data, userId);
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
router.post('/:id/phases/:phaseId/installments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = GenerateInstallmentsSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.generateInstallments(req.params.phaseId, data, userId);
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
router.post('/:id/phases/:phaseId/steps/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CompleteStepSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.completeStep(req.params.phaseId, data, userId);
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
router.post('/:id/phases/:phaseId/steps/:stepId/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ success: false, error: 'Rejection reason is required' });
            return;
        }
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.rejectStep(req.params.phaseId, req.params.stepId, reason, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Request changes on a step (admin action)
router.post('/:id/phases/:phaseId/steps/:stepId/request-changes', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ success: false, error: 'Change request reason is required' });
            return;
        }
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.requestStepChanges(req.params.phaseId, req.params.stepId, reason, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Get documents for a phase
router.get('/:id/phases/:phaseId/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const documents = await applicationPhaseService.getDocumentsByPhase(req.params.phaseId);
        res.json(successResponse(documents));
    } catch (error) {
        next(error);
    }
});

// Get installments for a phase
router.get('/:id/phases/:phaseId/installments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = req.query.status as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
        const installments = await applicationPhaseService.getInstallmentsByPhase(req.params.phaseId, { status, limit });
        res.json(successResponse(installments));
    } catch (error) {
        next(error);
    }
});

// Upload document for phase
router.post('/:id/phases/:phaseId/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UploadDocumentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const document = await applicationPhaseService.uploadDocument(req.params.phaseId, data, userId);
        res.status(201).json(successResponse(document));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Review/approve a document
router.post('/:id/documents/:documentId/review', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ApproveDocumentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const document = await applicationPhaseService.approveDocument(req.params.documentId, data, userId);
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
router.post('/:id/phases/:phaseId/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.complete(req.params.phaseId, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Skip phase (admin)
router.post('/:id/phases/:phaseId/skip', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { reason } = req.body;
        const phase = await applicationPhaseService.skip(req.params.phaseId, userId, reason);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// PAYMENT ROUTES
// ============================================================================

// Create payment
router.post('/:id/payments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CreatePaymentSchema.parse({
            ...req.body,
            applicationId: req.params.id,
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
router.get('/:id/payments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payments = await applicationPaymentService.findByApplication(req.params.id);
        res.json(successResponse(payments));
    } catch (error) {
        next(error);
    }
});

// Get payment by ID
router.get('/:id/payments/:paymentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payment = await applicationPaymentService.findById(req.params.paymentId);
        res.json(successResponse(payment));
    } catch (error) {
        next(error);
    }
});

// Process payment (webhook callback)
router.post('/payments/process', async (req: Request, res: Response, next: NextFunction) => {
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

// Refund payment
router.post('/:id/payments/:paymentId/refund', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = RefundPaymentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const payment = await applicationPaymentService.refund(req.params.paymentId, data, userId);
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
router.post('/:id/pay-ahead', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { amount } = req.body;
        if (typeof amount !== 'number' || amount <= 0) {
            res.status(400).json({ success: false, error: 'amount must be a positive number' });
            return;
        }
        const { userId } = getAuthContext(req);
        const result = await applicationPaymentService.payAhead(req.params.id, amount, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

export default router;
