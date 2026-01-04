import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { UnderwritingService } from '../services/underwriting.service';
import {
    UnderwritingRequestSchema,
    ManualReviewRequestSchema,
} from '../validators/underwriting.validator';

const router = Router();

/**
 * POST /underwriting/evaluate
 * Trigger automated underwriting for a prequalification
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
        const result = await service.evaluate(parsed.data.prequalificationId, actorId);

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
 * GET /underwriting/:id
 * Get an underwriting decision by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        const service = new UnderwritingService(prisma);

        const result = await service.getById(id);
        if (!result) {
            return res.status(404).json({ error: 'Decision not found' });
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Failed to get underwriting decision', error);
        return res.status(500).json({
            error: 'Failed to get underwriting decision',
            message: error.message,
        });
    }
});

/**
 * GET /underwriting/prequalification/:prequalificationId
 * Get all underwriting decisions for a prequalification
 */
router.get('/prequalification/:prequalificationId', async (req: Request, res: Response): Promise<any> => {
    try {
        const { prequalificationId } = req.params;

        const service = new UnderwritingService(prisma);

        const results = await service.getByPrequalificationId(prequalificationId);

        return res.status(200).json(results);
    } catch (error: any) {
        console.error('Failed to get underwriting decisions', error);
        return res.status(500).json({
            error: 'Failed to get underwriting decisions',
            message: error.message,
        });
    }
});

/**
 * POST /underwriting/:id/review
 * Manual review override for an underwriting decision (admin only)
 */
router.post('/:id/review', async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const parsed = ManualReviewRequestSchema.safeParse({ ...req.body, decisionId: id });

        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid request',
                details: parsed.error.issues,
            });
        }

        const reviewerId = (req as any).user?.id;
        if (!reviewerId) {
            return res.status(401).json({ error: 'Unauthorized - reviewer ID required' });
        }

        const service = new UnderwritingService(prisma);

        const result = await service.manualReview(
            id,
            reviewerId,
            parsed.data.decision,
            parsed.data.notes,
            parsed.data.conditions
        );

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Manual review failed', error);
        return res.status(500).json({
            error: 'Manual review failed',
            message: error.message,
        });
    }
});

export default router;
