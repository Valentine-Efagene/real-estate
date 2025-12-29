import { Router } from 'express';
import { PaymentPlanTemplateService } from '../services/payment-plan-template.service.js';
import {
    createPaymentPlanTemplateSchema,
    updatePaymentPlanTemplateSchema,
    clonePaymentPlanTemplateSchema,
} from '../validators/payment-plan-template.validator.js';

const router = Router();
const service = new PaymentPlanTemplateService();

/**
 * Create a new payment plan template
 */
router.post('/', async (req, res, next) => {
    try {
        const data = createPaymentPlanTemplateSchema.parse(req.body);
        const template = await service.create(data);
        res.status(201).json(template);
    } catch (error) {
        next(error);
    }
});

/**
 * Get all payment plan templates
 */
router.get('/', async (req, res, next) => {
    try {
        const { category, isActive } = req.query;
        const templates = await service.getAll({
            category: category as string,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        });
        res.json(templates);
    } catch (error) {
        next(error);
    }
});

/**
 * Get template by ID
 */
router.get('/:id', async (req, res, next) => {
    try {
        const template = await service.getById(req.params.id);
        res.json(template);
    } catch (error) {
        next(error);
    }
});

/**
 * Update template
 */
router.patch('/:id', async (req, res, next) => {
    try {
        const data = updatePaymentPlanTemplateSchema.parse(req.body);
        const template = await service.update(req.params.id, data);
        res.json(template);
    } catch (error) {
        next(error);
    }
});

/**
 * Delete template
 */
router.delete('/:id', async (req, res, next) => {
    try {
        await service.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

/**
 * Clone template
 */
router.post('/:id/clone', async (req, res, next) => {
    try {
        const { newName } = clonePaymentPlanTemplateSchema.parse(req.body);
        const template = await service.clone(req.params.id, newName);
        res.status(201).json(template);
    } catch (error) {
        next(error);
    }
});

/**
 * Validate template configuration
