import { Router, Request, Response, NextFunction } from 'express';
import { templateService } from '../services/template.service';
import { GenerateDocumentSchema } from '../validators/template.validator';
import { z } from 'zod';

const router = Router();

// ============================================================================
// DOCUMENT GENERATION ROUTES (Service-to-Service)
// ============================================================================

/**
 * Generate document from template
 * POST /generate
 * 
 * This endpoint is called by other services (e.g., mortgage-service)
 * to generate documents from templates with merge data.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing tenant context' });
        }

        const data = GenerateDocumentSchema.parse(req.body);
        const result = await templateService.generate(data, tenantId);
        res.json(result);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Generate offer letter specifically
 * POST /generate/offer-letter
 * 
 * Convenience endpoint for generating offer letters with
 * predefined template codes (PROVISIONAL_OFFER, FINAL_OFFER)
 */
router.post('/offer-letter', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing tenant context' });
        }

        const { type, mergeData } = req.body;

        if (!type || !['PROVISIONAL', 'FINAL'].includes(type)) {
            return res.status(400).json({ error: 'type must be PROVISIONAL or FINAL' });
        }

        if (!mergeData) {
            return res.status(400).json({ error: 'mergeData is required' });
        }

        const templateCode = type === 'PROVISIONAL' ? 'PROVISIONAL_OFFER' : 'FINAL_OFFER';

        const result = await templateService.generate(
            { templateCode, mergeData },
            tenantId
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * Preview document with sample data
 * POST /generate/preview
 * 
 * Used by admin to preview templates with sample merge data
 */
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing tenant context' });
        }

        const { templateId, templateCode, sampleData } = req.body;

        if (!templateId && !templateCode) {
            return res.status(400).json({ error: 'Either templateId or templateCode is required' });
        }

        const result = await templateService.generate(
            {
                templateId,
                templateCode,
                mergeData: sampleData || {},
            },
            tenantId
        );

        // Return HTML content type for direct rendering
        res.setHeader('Content-Type', 'text/html');
        res.send(result.html);
    } catch (error) {
        next(error);
    }
});

export default router;
