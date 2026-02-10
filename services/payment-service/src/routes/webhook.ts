import { Router, Request, Response, NextFunction } from 'express';
import { walletService, BudPayWebhookPayload } from '../services/wallet.service';

// =============================================================================
// Webhook Routes
// =============================================================================
// Handles incoming webhooks from payment providers (BudPay)
// These endpoints are unauthenticated but verified via signatures
// =============================================================================

const router = Router();

/**
 * POST /webhooks/budpay
 * BudPay webhook endpoint for virtual account credits
 * 
 * This is called by BudPay when a user pays into their virtual account.
 * The webhook verifies the signature and credits the user's wallet.
 */
router.post('/budpay', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payload: BudPayWebhookPayload = req.body;
        const signature = req.headers['x-budpay-signature'] as string || '';

        console.log('[Webhook] Received BudPay webhook:', {
            event: payload.event,
            reference: payload.data?.reference,
            amount: payload.data?.amount,
        });

        const result = await walletService.processBudPayWebhook(payload, signature);

        // Always return 200 to acknowledge receipt
        // This prevents BudPay from retrying
        return res.status(200).json({
            success: true,
            message: 'Webhook processed',
            data: result,
        });
    } catch (error: any) {
        console.error('[Webhook] BudPay webhook error:', error);

        // Still return 200 to prevent retries on our errors
        // We log the error for investigation
        return res.status(200).json({
            status: 'error',
            message: error.message || 'Webhook processing failed',
        });
    }
});

/**
 * POST /webhooks/budpay/mock
 * Mock BudPay webhook for development/testing
 * 
 * This allows testing the payment flow without a real bank transfer.
 * Only available in development environments.
 */
router.post('/budpay/mock', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, amount, reference, bankName = 'Test Bank' } = req.body;

        if (!email || !amount) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'email and amount are required' },
            });
        }

        // Construct a mock BudPay payload
        const mockPayload: BudPayWebhookPayload = {
            event: 'virtualaccount.credit',
            data: {
                reference: reference || `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                amount: Math.round(amount * 100), // Convert to kobo
                currency: 'NGN',
                status: 'successful',
                customer: {
                    email,
                    name: 'Mock Customer',
                },
                account: {
                    account_number: '0000000000',
                    account_name: 'Mock Account',
                    bank_name: bankName,
                },
                paidAt: new Date().toISOString(),
            },
        };

        console.log('[Webhook] Processing mock BudPay webhook:', {
            email,
            amount,
            reference: mockPayload.data.reference,
        });

        const result = await walletService.processBudPayWebhook(mockPayload, 'mock-signature');

        return res.status(200).json({
            success: true,
            message: 'Mock webhook processed',
            data: result,
        });
    } catch (error: any) {
        console.error('[Webhook] Mock webhook error:', error);
        next(error);
    }
});

export default router;
