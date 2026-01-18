import { Router, Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { AppError } from '@valentine-efagene/qshelter-common';
import { z } from 'zod';

// =============================================================================
// Wallet Routes
// =============================================================================
// Authenticated endpoints for wallet management
// User context comes from API Gateway authorizer via tenantContext middleware
// =============================================================================

const router = Router();

// ============================================================================
// Schemas
// ============================================================================

const createWalletSchema = z.object({
    currency: z.string().default('NGN'),
});

const creditWalletSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    reference: z.string().min(1, 'Reference is required'),
    description: z.string().optional(),
});

const debitWalletSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    reference: z.string().min(1, 'Reference is required'),
    description: z.string().optional(),
});

const transactionsQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
});

// ============================================================================
// User Wallet Endpoints
// ============================================================================

/**
 * GET /wallets/me
 * Get current user's wallet
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.tenantContext?.userId;
        if (!userId) {
            throw new AppError(401, 'Unauthorized');
        }

        const wallet = await walletService.findByUserId(userId);

        return res.status(200).json({
            status: 'success',
            data: wallet,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /wallets/me
 * Create wallet for current user
 */
router.post('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.tenantContext?.userId;
        const tenantId = req.tenantContext?.tenantId;
        if (!userId || !tenantId) {
            throw new AppError(401, 'Unauthorized');
        }

        const { currency } = createWalletSchema.parse(req.body);
        const wallet = await walletService.createForUser(userId, tenantId, currency);

        return res.status(201).json({
            status: 'success',
            message: 'Wallet created successfully',
            data: wallet,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /wallets/me/transactions
 * Get current user's transaction history
 */
router.get('/me/transactions', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.tenantContext?.userId;
        if (!userId) {
            throw new AppError(401, 'Unauthorized');
        }

        const { limit, offset } = transactionsQuerySchema.parse(req.query);
        const wallet = await walletService.findByUserId(userId);
        const result = await walletService.getTransactions(wallet.id, limit, offset);
        const page = Math.floor(offset / limit) + 1;

        return res.status(200).json({
            status: 'success',
            data: {
                data: result.transactions,
                total: result.total,
                page,
                pageSize: limit,
                totalPages: Math.ceil(result.total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// Internal Service Endpoints (called by other services)
// ============================================================================

/**
 * GET /wallets/:id
 * Get wallet by ID (internal use)
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const wallet = await walletService.findById(id);

        return res.status(200).json({
            status: 'success',
            data: wallet,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /wallets/user/:userId
 * Get wallet by user ID (internal use)
 */
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.userId as string;
        const wallet = await walletService.findByUserId(userId);

        return res.status(200).json({
            status: 'success',
            data: wallet,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /wallets/user/:userId
 * Create wallet for user (internal use)
 * Requires tenantId in body since this is an internal API call
 */
router.post('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.userId as string;
        const tenantId = req.tenantContext?.tenantId || req.body.tenantId;
        if (!tenantId) {
            throw new AppError(400, 'tenantId is required');
        }
        const { currency } = createWalletSchema.parse(req.body);
        const wallet = await walletService.createForUser(userId, tenantId, currency);

        return res.status(201).json({
            status: 'success',
            message: 'Wallet created successfully',
            data: wallet,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /wallets/:id/credit
 * Credit a wallet (internal use by other services)
 */
router.post('/:id/credit', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const walletId = req.params.id as string;
        const input = creditWalletSchema.parse(req.body);

        const result = await walletService.credit({
            walletId,
            ...input,
        });

        return res.status(200).json({
            status: 'success',
            message: 'Wallet credited successfully',
            data: {
                wallet: result.wallet,
                transaction: result.transaction,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /wallets/:id/debit
 * Debit a wallet (internal use by other services)
 */
router.post('/:id/debit', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const walletId = req.params.id as string;
        const input = debitWalletSchema.parse(req.body);

        const result = await walletService.debit({
            walletId,
            ...input,
        });

        return res.status(200).json({
            status: 'success',
            message: 'Wallet debited successfully',
            data: {
                wallet: result.wallet,
                transaction: result.transaction,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /wallets/:id/transactions
 * Get transactions for a wallet (internal use)
 */
router.get('/:id/transactions', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const walletId = req.params.id as string;
        const { limit, offset } = transactionsQuerySchema.parse(req.query);

        // Verify wallet exists
        await walletService.findById(walletId);
        const result = await walletService.getTransactions(walletId, limit, offset);
        const page = Math.floor(offset / limit) + 1;

        return res.status(200).json({
            status: 'success',
            data: {
                data: result.transactions,
                total: result.total,
                page,
                pageSize: limit,
                totalPages: Math.ceil(result.total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
