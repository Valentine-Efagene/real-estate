import { Router, Request, Response, NextFunction } from 'express';
import { paymentMethodService } from '../services/payment-method.service.js';
import {
    CreatePaymentMethodSchema,
    UpdatePaymentMethodSchema,
    AddPhaseSchema,
    LinkToPropertySchema,
} from '../validators/payment-method.validator.js';
import { z } from 'zod';

const router = Router();

// Create payment method
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CreatePaymentMethodSchema.parse(req.body);
        const method = await paymentMethodService.create(data);
        res.status(201).json(method);
    } catch (error) {
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
        const data = AddPhaseSchema.partial().parse(req.body);
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

export default router;
