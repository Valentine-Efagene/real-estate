import { Router, Request, Response, NextFunction } from 'express';
import { paymentPlanService } from '../services/payment-plan.service';
import { CreatePaymentPlanSchema, UpdatePaymentPlanSchema } from '../validators/payment-plan.validator';
import { z } from 'zod';

const router = Router();

// Create payment plan
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            res.status(400).json({ error: 'x-tenant-id header is required' });
            return;
        }
        const data = CreatePaymentPlanSchema.parse(req.body);
        const plan = await paymentPlanService.create(tenantId, data);
        res.status(201).json(plan);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all payment plans
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const plans = await paymentPlanService.findAll({ isActive });
        res.json(plans);
    } catch (error) {
        next(error);
    }
});

// Get payment plan by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const plan = await paymentPlanService.findById(req.params.id);
        res.json(plan);
    } catch (error) {
        next(error);
    }
});

// Update payment plan
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdatePaymentPlanSchema.parse(req.body);
        const plan = await paymentPlanService.update(req.params.id, data);
        res.json(plan);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete payment plan
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await paymentPlanService.delete(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Clone payment plan
router.post('/:id/clone', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ error: 'name is required for cloning' });
            return;
        }
        const plan = await paymentPlanService.clone(req.params.id, name);
        res.status(201).json(plan);
    } catch (error) {
        next(error);
    }
});

export default router;
