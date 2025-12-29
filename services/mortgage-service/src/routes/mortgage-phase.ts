import { Router } from 'express';
import { MortgagePhaseService } from '../services/mortgage-phase.service.js';
import {
    createMortgagePhaseSchema,
    generateInstallmentsSchema,
} from '../validators/mortgage-phase.validator.js';

const router = Router();
const service = new MortgagePhaseService();

/**
 * Create a new mortgage phase
 */
router.post('/', async (req, res, next) => {
    try {
        const data = createMortgagePhaseSchema.parse(req.body);
        const phase = await service.create({
            ...data,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            endDate: data.endDate ? new Date(data.endDate) : undefined,
        });
        res.status(201).json(phase);
    } catch (error) {
        next(error);
    }
});

/**
 * Get all phases for a mortgage
 */
router.get('/mortgage/:mortgageId', async (req, res, next) => {
    try {
        const phases = await service.getByMortgageId(req.params.mortgageId);
        res.json(phases);
    } catch (error) {
        next(error);
    }
});

/**
 * Get phase by ID
 */
router.get('/:id', async (req, res, next) => {
    try {
        const phase = await service.getById(req.params.id);
        res.json(phase);
    } catch (error) {
        next(error);
    }
});

/**
 * Activate a phase
 */
router.post('/:id/activate', async (req, res, next) => {
    try {
        const phase = await service.activate(req.params.id);
        res.json(phase);
    } catch (error) {
        next(error);
    }
});

/**
 * Complete a phase
 */
router.post('/:id/complete', async (req, res, next) => {
    try {
        const phase = await service.complete(req.params.id);
        res.json(phase);
    } catch (error) {
        next(error);
    }
});

/**
 * Generate installments for a phase
 */
router.post('/:id/installments', async (req, res, next) => {
    try {
        const data = generateInstallmentsSchema.parse(req.body);
        const installments = await service.generateInstallments(req.params.id, {
            ...data,
            startDate: new Date(data.startDate),
        });
        res.status(201).json(installments);
    } catch (error) {
        next(error);
    }
});

export default router;
