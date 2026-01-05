import { Router, Request, Response, NextFunction } from 'express';
import { contractService } from '../services/contract.service';
import { contractPhaseService } from '../services/contract-phase.service';
import { contractPaymentService } from '../services/contract-payment.service';
import { ContractStatus } from '@valentine-efagene/qshelter-common';
import {
    CreateContractSchema,
    UpdateContractSchema,
    TransitionContractSchema,
} from '../validators/contract.validator';
import {
    ActivatePhaseSchema,
    CompleteStepSchema,
    UploadDocumentSchema,
    GenerateInstallmentsSchema,
    ApproveDocumentSchema,
} from '../validators/contract-phase.validator';
import {
    CreatePaymentSchema,
    ProcessPaymentSchema,
    RefundPaymentSchema,
} from '../validators/contract-payment.validator';
import { z } from 'zod';
import { getAuthContext } from '@valentine-efagene/qshelter-common';

const router = Router();

// ============================================================================
// CONTRACT ROUTES
// ============================================================================

// Create contract from payment method
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId, userId } = getAuthContext(req);
        const data = CreateContractSchema.parse(req.body);
        // Use userId from header as buyerId if not provided in body
        const contractData = { ...data, tenantId, buyerId: data.buyerId || userId };
        const contract = await contractService.create(contractData);
        res.status(201).json(contract);
    } catch (error: any) {
        console.error('Contract create error:', error.message);
        if (error instanceof z.ZodError) {
            console.error('Zod validation error:', JSON.stringify(error.issues, null, 2));
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all contracts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { buyerId, propertyUnitId, status } = req.query;
        const contracts = await contractService.findAll({
            buyerId: buyerId as string,
            propertyUnitId: propertyUnitId as string,
            status: status as ContractStatus | undefined,
        });
        res.json(contracts);
    } catch (error) {
        next(error);
    }
});

// Get contract by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contract = await contractService.findById(req.params.id);
        res.json(contract);
    } catch (error) {
        next(error);
    }
});

// Get current action required for a contract
// This is the canonical endpoint for the app to know what to show the user
router.get('/:id/current-action', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await contractService.getCurrentAction(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get contract by contract number
router.get('/number/:contractNumber', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const contract = await contractService.findByContractNumber(req.params.contractNumber);
        res.json(contract);
    } catch (error) {
        next(error);
    }
});

// Update contract
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateContractSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const contract = await contractService.update(req.params.id, data, userId);
        res.json(contract);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Transition contract state
router.post('/:id/transition', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = TransitionContractSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const contract = await contractService.transition(req.params.id, data, userId);
        res.json(contract);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Sign contract
router.post('/:id/sign', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const contract = await contractService.sign(req.params.id, userId);
        res.json(contract);
    } catch (error) {
        next(error);
    }
});

// Cancel contract
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { reason } = req.body;
        const contract = await contractService.cancel(req.params.id, userId, reason);
        res.json(contract);
    } catch (error) {
        next(error);
    }
});

// Delete contract (draft only)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const result = await contractService.delete(req.params.id, userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// PHASE ROUTES
// ============================================================================

// Get phases for a contract
router.get('/:id/phases', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phases = await contractPhaseService.getPhasesByContract(req.params.id);
        res.json(phases);
    } catch (error) {
        next(error);
    }
});

// Get phase by ID
router.get('/:id/phases/:phaseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phase = await contractPhaseService.findById(req.params.phaseId);
        res.json(phase);
    } catch (error) {
        next(error);
    }
});

// Activate phase
router.post('/:id/phases/:phaseId/activate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ActivatePhaseSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await contractPhaseService.activate(req.params.phaseId, data, userId);
        res.json(phase);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
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
        const phase = await contractPhaseService.generateInstallments(req.params.phaseId, data, userId);
        // Transform installments to include amountDue for backwards compatibility
        const responsePhase = {
            ...phase,
            installments: phase.installments.map((inst: any) => ({
                ...inst,
                amountDue: inst.amount,
            })),
        };
        res.json(responsePhase);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
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
        const phase = await contractPhaseService.completeStep(req.params.phaseId, data, userId);
        res.json(phase);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
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
            res.status(400).json({ error: 'Rejection reason is required' });
            return;
        }
        const { userId } = getAuthContext(req);
        const phase = await contractPhaseService.rejectStep(req.params.phaseId, req.params.stepId, reason, userId);
        res.json(phase);
    } catch (error) {
        next(error);
    }
});

// Request changes on a step (admin action)
router.post('/:id/phases/:phaseId/steps/:stepId/request-changes', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ error: 'Change request reason is required' });
            return;
        }
        const { userId } = getAuthContext(req);
        const phase = await contractPhaseService.requestStepChanges(req.params.phaseId, req.params.stepId, reason, userId);
        res.json(phase);
    } catch (error) {
        next(error);
    }
});

// Upload document for phase
router.post('/:id/phases/:phaseId/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UploadDocumentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const document = await contractPhaseService.uploadDocument(req.params.phaseId, data, userId);
        res.status(201).json(document);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
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
        const document = await contractPhaseService.approveDocument(req.params.documentId, data, userId);
        res.json(document);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Complete phase
router.post('/:id/phases/:phaseId/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const phase = await contractPhaseService.complete(req.params.phaseId, userId);
        res.json(phase);
    } catch (error) {
        next(error);
    }
});

// Skip phase (admin)
router.post('/:id/phases/:phaseId/skip', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { reason } = req.body;
        const phase = await contractPhaseService.skip(req.params.phaseId, userId, reason);
        res.json(phase);
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
            contractId: req.params.id,
        });
        const { userId } = getAuthContext(req);
        const payment = await contractPaymentService.create(data, userId);
        res.status(201).json(payment);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get payments for contract
router.get('/:id/payments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payments = await contractPaymentService.findByContract(req.params.id);
        res.json(payments);
    } catch (error) {
        next(error);
    }
});

// Get payment by ID
router.get('/:id/payments/:paymentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payment = await contractPaymentService.findById(req.params.paymentId);
        res.json(payment);
    } catch (error) {
        next(error);
    }
});

// Process payment (webhook callback)
router.post('/payments/process', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ProcessPaymentSchema.parse(req.body);
        const payment = await contractPaymentService.process(data);
        res.json(payment);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
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
        const payment = await contractPaymentService.refund(req.params.paymentId, data, userId);
        res.json(payment);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
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
            res.status(400).json({ error: 'amount must be a positive number' });
            return;
        }
        const { userId } = getAuthContext(req);
        const result = await contractPaymentService.payAhead(req.params.id, amount, userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
