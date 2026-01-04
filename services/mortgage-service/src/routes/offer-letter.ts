import { Router, Request, Response, NextFunction } from 'express';
import { offerLetterService } from '../services/offer-letter.service';
import {
    GenerateOfferLetterSchema,
    SendOfferLetterSchema,
    SignOfferLetterSchema,
    UpdateOfferLetterSchema,
    CancelOfferLetterSchema,
    ListOfferLettersSchema,
} from '../validators/offer-letter.validator';
import { z } from 'zod';

const router = Router();

// ============================================================================
// OFFER LETTER ROUTES
// ============================================================================

/**
 * Generate an offer letter for a contract
 * POST /offer-letters
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(400).json({ error: 'Missing user context' });
        }

        const data = GenerateOfferLetterSchema.parse(req.body);
        const offerLetter = await offerLetterService.generate(data, userId);
        res.status(201).json(offerLetter);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            console.error('Zod validation error:', JSON.stringify(error.issues, null, 2));
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * List offer letters with filters
 * GET /offer-letters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = ListOfferLettersSchema.parse(req.query);
        const offerLetters = await offerLetterService.findAll(filters);
        res.json(offerLetters);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Get offer letter by ID
 * GET /offer-letters/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const offerLetter = await offerLetterService.findById(req.params.id);
        res.json(offerLetter);
    } catch (error) {
        next(error);
    }
});

/**
 * Get offer letters for a contract
 * GET /offer-letters/contract/:contractId
 */
router.get('/contract/:contractId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const offerLetters = await offerLetterService.findByContract(req.params.contractId);
        res.json(offerLetters);
    } catch (error) {
        next(error);
    }
});

/**
 * Send offer letter to buyer
 * POST /offer-letters/:id/send
 */
router.post('/:id/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(400).json({ error: 'Missing user context' });
        }

        const data = SendOfferLetterSchema.parse(req.body);
        const offerLetter = await offerLetterService.send(req.params.id, data, userId);
        res.json(offerLetter);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Mark offer letter as viewed (called when buyer opens the letter)
 * POST /offer-letters/:id/view
 */
router.post('/:id/view', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const offerLetter = await offerLetterService.markViewed(req.params.id);
        res.json(offerLetter);
    } catch (error) {
        next(error);
    }
});

/**
 * Sign offer letter (buyer acceptance)
 * POST /offer-letters/:id/sign
 */
router.post('/:id/sign', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = SignOfferLetterSchema.parse(req.body);
        // Get signer's IP for audit
        const signerIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || 'unknown';
        const offerLetter = await offerLetterService.sign(req.params.id, data, signerIp);
        res.json(offerLetter);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Update offer letter (e.g., add PDF URL)
 * PATCH /offer-letters/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(400).json({ error: 'Missing user context' });
        }

        const data = UpdateOfferLetterSchema.parse(req.body);
        const offerLetter = await offerLetterService.update(req.params.id, data, userId);
        res.json(offerLetter);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Cancel offer letter
 * POST /offer-letters/:id/cancel
 */
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(400).json({ error: 'Missing user context' });
        }

        const data = CancelOfferLetterSchema.parse(req.body);
        const offerLetter = await offerLetterService.cancel(req.params.id, data, userId);
        res.json(offerLetter);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Manually trigger expiration check (for admin/testing)
 * POST /offer-letters/check-expired
 */
router.post('/check-expired', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const count = await offerLetterService.checkExpired();
        res.json({ expired: count });
    } catch (error) {
        next(error);
    }
});

export default router;
