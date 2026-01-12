import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { UnderwritingService } from '../services/underwriting.service';
import {
    UnderwritingRequestSchema,
} from '../validators/underwriting.validator';

const router = Router();

/**
 * POST /underwriting/evaluate
 * Trigger automated underwriting for a application's UNDERWRITING step
 */
router.post('/evaluate', async (req: Request, res: Response): Promise<any> => {
    try {
        const parsed = UnderwritingRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request',
                details: parsed.error.issues,
            });
        }

        const service = new UnderwritingService(prisma);

        const actorId = (req as any).user?.id;
        const result = await service.evaluateForStep(
            parsed.data.applicationId,
            parsed.data.stepId,
            actorId
        );

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Underwriting evaluation failed', error);
        return res.status(500).json({
            error: 'Underwriting evaluation failed',
            message: error.message,
        });
    }
});

/**
 * GET /underwriting/step/:stepId
 * Get underwriting results for a specific step
 */
router.get('/step/:stepId', async (req: Request, res: Response): Promise<any> => {
    try {
        const { stepId } = req.params;

        const service = new UnderwritingService(prisma);

        const result = await service.getByStepId(stepId);
        if (!result) {
            return res.status(404).json({ error: 'Underwriting step not found' });
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Failed to get underwriting result', error);
        return res.status(500).json({
            error: 'Failed to get underwriting result',
            message: error.message,
        });
    }
});

/**
 * GET /underwriting/application/:applicationId
 * Get all underwriting results for a application
 */
router.get('/application/:applicationId', async (req: Request, res: Response): Promise<any> => {
    try {
        const { applicationId } = req.params;

        const service = new UnderwritingService(prisma);

        const results = await service.getByApplicationId(applicationId);

        return res.status(200).json(results);
    } catch (error: any) {
        console.error('Failed to get underwriting results', error);
        return res.status(500).json({
            error: 'Failed to get underwriting results',
            message: error.message,
        });
    }
});

export default router;
