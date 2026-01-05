import { Router, Request, Response, NextFunction } from 'express';
import { prequalificationService } from '../services/prequalification.service';
import {
    CreatePrequalificationSchema,
    UpdatePrequalificationSchema,
    SubmitDocumentSchema,
    ReviewPrequalificationSchema,
} from '../validators/prequalification.validator';
import { z } from 'zod';
import * as express from 'express'
import { checkIdempotency, setIdempotencyResponse } from '../lib/idempotency';
import { getAuthContext } from '@valentine-efagene/qshelter-common';

const router: express.Router = Router();

// Create a new prequalification
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId, userId } = getAuthContext(req);

        const idempotencyKey = req.headers['x-idempotency-key'] as string;
        if (idempotencyKey) {
            const cached = await checkIdempotency(idempotencyKey);
            if (cached) return res.status(200).json(cached);
        }

        const data = CreatePrequalificationSchema.parse(req.body);
        const result = await prequalificationService.create(tenantId, userId, data);

        if (idempotencyKey) {
            await setIdempotencyResponse(idempotencyKey, result);
        }

        res.status(201).json(result);
    } catch (error: any) {
        console.error('Prequalification create error:', error.message);
        if (error instanceof z.ZodError) {
            console.error('Zod error details:', JSON.stringify(error.issues, null, 2));
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        next(error);
    }
});

// Get all prequalifications for tenant
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);

        const filters = {
            status: req.query.status as string | undefined,
            userId: req.query.userId as string | undefined,
        };

        const results = await prequalificationService.findAll(tenantId, filters);
        res.json(results);
    } catch (error) {
        next(error);
    }
});

// Get a specific prequalification
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await prequalificationService.findById(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Update a prequalification
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdatePrequalificationSchema.parse(req.body);
        const result = await prequalificationService.update(req.params.id, data);
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        next(error);
    }
});

// Delete a prequalification
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await prequalificationService.delete(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get required documents for a prequalification
router.get('/:id/required-documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const results = await prequalificationService.getRequiredDocuments(req.params.id);
        res.json(results);
    } catch (error) {
        next(error);
    }
});

// Submit a document
router.post('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        if (!userId) {
            return res.status(400).json({ error: 'Missing user context' });
        }

        const idempotencyKey = req.headers['x-idempotency-key'] as string;
        if (idempotencyKey) {
            const cached = await checkIdempotency(idempotencyKey);
            if (cached) return res.status(200).json(cached);
        }

        const data = SubmitDocumentSchema.parse(req.body);
        const result = await prequalificationService.submitDocument(req.params.id, userId, data);

        if (idempotencyKey) {
            await setIdempotencyResponse(idempotencyKey, result);
        }

        res.status(201).json(result);
    } catch (error: any) {
        console.error('Submit document error:', error.message);
        if (error instanceof z.ZodError) {
            console.error('Zod validation error:', JSON.stringify(error.issues, null, 2));
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        next(error);
    }
});

// Submit prequalification for review
router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idempotencyKey = req.headers['x-idempotency-key'] as string;
        if (idempotencyKey) {
            const cached = await checkIdempotency(idempotencyKey);
            if (cached) return res.status(200).json(cached);
        }

        const result = await prequalificationService.submit(req.params.id);

        if (idempotencyKey) {
            await setIdempotencyResponse(idempotencyKey, result);
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Review a prequalification (admin action)
router.post('/:id/review', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        if (!userId) {
            return res.status(400).json({ error: 'Missing user context' });
        }

        const idempotencyKey = req.headers['x-idempotency-key'] as string;
        if (idempotencyKey) {
            const cached = await checkIdempotency(idempotencyKey);
            if (cached) return res.status(200).json(cached);
        }

        const data = ReviewPrequalificationSchema.parse(req.body);
        const result = await prequalificationService.review(req.params.id, userId, data);

        if (idempotencyKey) {
            await setIdempotencyResponse(idempotencyKey, result);
        }

        res.json(result);
    } catch (error: any) {
        console.error('Review prequalification error:', error.message);
        if (error instanceof z.ZodError) {
            console.error('Zod validation error:', JSON.stringify(error.issues, null, 2));
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        next(error);
    }
});

export default router;
