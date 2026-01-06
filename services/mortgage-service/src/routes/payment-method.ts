import { Router, Request, Response, NextFunction } from 'express';
import { paymentMethodService } from '../services/payment-method.service';
import {
    CreatePaymentMethodSchema,
    UpdatePaymentMethodSchema,
    AddPhaseSchema,
    PartialPhaseSchema,
    LinkToPropertySchema,
    AddStepSchema,
    UpdateStepSchema,
    ReorderStepsSchema,
    AddDocumentRequirementSchema,
    UpdateDocumentRequirementSchema,
    ClonePaymentMethodSchema,
} from '../validators/payment-method.validator';
import {
    AttachHandlerToStepSchema,
    UpdateStepAttachmentSchema,
} from '../validators/event-config.validator';
import { z } from 'zod';
import { getAuthContext } from '@valentine-efagene/qshelter-common';

const router = Router();

// Create payment method
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreatePaymentMethodSchema.parse(req.body);
        const method = await paymentMethodService.create(tenantId, data);
        res.status(201).json(method);
    } catch (error: any) {
        console.error('Payment method create error:', error.message, error.statusCode || error.code);
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all payment methods
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const methods = await paymentMethodService.findAll({ isActive });
        res.json(methods);
    } catch (error) {
        next(error);
    }
});

// Get payment method by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const method = await paymentMethodService.findById(req.params.id);
        res.json(method);
    } catch (error) {
        next(error);
    }
});

// Update payment method
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdatePaymentMethodSchema.parse(req.body);
        const method = await paymentMethodService.update(req.params.id, data);
        res.json(method);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete payment method
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await paymentMethodService.delete(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Add phase to payment method
router.post('/:id/phases', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddPhaseSchema.parse(req.body);
        const phase = await paymentMethodService.addPhase(req.params.id, data);
        res.status(201).json(phase);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update phase
router.patch('/:id/phases/:phaseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = PartialPhaseSchema.parse(req.body);
        const phase = await paymentMethodService.updatePhase(req.params.phaseId, data);
        res.json(phase);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete phase
router.delete('/:id/phases/:phaseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await paymentMethodService.deletePhase(req.params.phaseId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Reorder phases
router.post('/:id/phases/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phaseOrders } = req.body;
        if (!Array.isArray(phaseOrders)) {
            res.status(400).json({ error: 'phaseOrders array is required' });
            return;
        }
        const method = await paymentMethodService.reorderPhases(req.params.id, phaseOrders);
        res.json(method);
    } catch (error) {
        next(error);
    }
});

// ============================================================
// Clone Template
// ============================================================

// Clone a payment method (duplicate template)
router.post('/:id/clone', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = ClonePaymentMethodSchema.parse(req.body);
        const cloned = await paymentMethodService.clone(req.params.id, tenantId, data);
        res.status(201).json(cloned);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// ============================================================
// Step CRUD within a Phase
// ============================================================

// Add step to phase
router.post('/:id/phases/:phaseId/steps', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddStepSchema.parse(req.body);
        const step = await paymentMethodService.addStep(req.params.phaseId, data);
        res.status(201).json(step);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update step
router.patch('/:id/phases/:phaseId/steps/:stepId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateStepSchema.parse(req.body);
        const step = await paymentMethodService.updateStep(req.params.stepId, data);
        res.json(step);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete step
router.delete('/:id/phases/:phaseId/steps/:stepId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await paymentMethodService.deleteStep(req.params.stepId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Reorder steps within a phase
router.post('/:id/phases/:phaseId/steps/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ReorderStepsSchema.parse(req.body);
        const steps = await paymentMethodService.reorderSteps(req.params.phaseId, data.stepOrders);
        res.json(steps);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// ============================================================
// Document Requirement CRUD within a Phase
// ============================================================

// Add document requirement to phase
router.post('/:id/phases/:phaseId/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddDocumentRequirementSchema.parse(req.body);
        const doc = await paymentMethodService.addDocumentRequirement(req.params.phaseId, data);
        res.status(201).json(doc);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update document requirement
router.patch('/:id/phases/:phaseId/documents/:documentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateDocumentRequirementSchema.parse(req.body);
        const doc = await paymentMethodService.updateDocumentRequirement(req.params.documentId, data);
        res.json(doc);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete document requirement
router.delete('/:id/phases/:phaseId/documents/:documentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await paymentMethodService.deleteDocumentRequirement(req.params.documentId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Link to property
router.post('/:id/properties', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = LinkToPropertySchema.parse(req.body);
        const link = await paymentMethodService.linkToProperty(req.params.id, data);
        res.status(201).json(link);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Unlink from property
router.delete('/:id/properties/:propertyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await paymentMethodService.unlinkFromProperty(req.params.id, req.params.propertyId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get payment methods for a property
router.get('/property/:propertyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const methods = await paymentMethodService.getMethodsForProperty(req.params.propertyId);
        res.json(methods);
    } catch (error) {
        next(error);
    }
});

// ============================================================
// Step Handler Attachment Routes
// ============================================================

// Attach a handler to a step
router.post('/:id/phases/:phaseId/steps/:stepId/handlers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AttachHandlerToStepSchema.parse(req.body);
        const attachment = await paymentMethodService.attachHandlerToStep(req.params.stepId, data);
        res.status(201).json(attachment);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// List all handlers attached to a step
router.get('/:id/phases/:phaseId/steps/:stepId/handlers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const attachments = await paymentMethodService.listStepHandlers(req.params.stepId);
        res.json(attachments);
    } catch (error) {
        next(error);
    }
});

// Update a step handler attachment
router.patch('/:id/phases/:phaseId/steps/:stepId/handlers/:attachmentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateStepAttachmentSchema.parse(req.body);
        const attachment = await paymentMethodService.updateStepAttachment(req.params.attachmentId, data);
        res.json(attachment);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Detach a handler from a step
router.delete('/:id/phases/:phaseId/steps/:stepId/handlers/:attachmentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await paymentMethodService.detachHandlerFromStep(req.params.attachmentId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
