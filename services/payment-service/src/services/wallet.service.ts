import { prisma } from '../lib/prisma';
import { AppError, PaymentEventPublisher } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Wallet Service
// =============================================================================
// Manages wallet operations including:
// - Credit/debit operations
// - Virtual account funding (via BudPay webhook)
// - Transaction history
// - Publishing events for downstream processing
// 
// Multi-tenancy: All tenant-scoped records (Wallet, Transaction, DomainEvent,
// ApplicationPayment) require tenantId. We get this from the wallet's tenant.
// =============================================================================

const paymentPublisher = new PaymentEventPublisher('payment-service');

export interface CreditWalletInput {
    walletId: string;
    amount: number;
    reference: string;
    description?: string;
    gatewayResponse?: Record<string, any>;
    source?: 'virtual_account' | 'manual' | 'refund';
}

export interface DebitWalletInput {
    walletId: string;
    amount: number;
    reference: string;
    description?: string;
}

export interface BudPayWebhookPayload {
    // BudPay webhook format for virtual account funding
    event: string; // e.g., "virtualaccount.credit"
    data: {
        reference: string;
        amount: number; // Amount in kobo (NGN minor units)
        currency: string;
        status: string;
        customer: {
            email: string;
            name?: string;
        };
        account: {
            account_number: string;
            account_name: string;
            bank_name: string;
        };
        paidAt?: string;
        metadata?: Record<string, any>;
    };
}

class WalletService {
    /**
     * Get wallet by ID
     */
    async findById(walletId: string) {
        const wallet = await prisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
            },
        });

        if (!wallet) {
            throw new AppError(404, 'Wallet not found');
        }

        return wallet;
    }

    /**
     * Get wallet by user ID
     */
    async findByUserId(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { walletId: true },
        });

        if (!user?.walletId) {
            throw new AppError(404, 'User does not have a wallet');
        }

        return this.findById(user.walletId);
    }

    /**
     * Create a wallet for a user
     * @param userId - The user to create wallet for
     * @param tenantId - The tenant to scope the wallet to
     * @param currency - The wallet currency (default NGN)
     */
    async createForUser(userId: string, tenantId: string, currency: string = 'NGN') {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { walletId: true },
        });

        if (user?.walletId) {
            throw new AppError(400, 'User already has a wallet');
        }

        const wallet = await prisma.$transaction(async (tx) => {
            const newWallet = await tx.wallet.create({
                data: {
                    tenantId,
                    balance: 0,
                    currency,
                },
            });

            await tx.user.update({
                where: { id: userId },
                data: { walletId: newWallet.id },
            });

            return newWallet;
        });

        return wallet;
    }

    /**
     * Credit wallet (add funds)
     * Called when:
     * - BudPay webhook receives virtual account funding
     * - Manual top-up
     * - Refund credited back
     */
    async credit(input: CreditWalletInput) {
        const { walletId, amount, reference, description, gatewayResponse, source = 'manual' } = input;

        if (amount <= 0) {
            throw new AppError(400, 'Credit amount must be positive');
        }

        // Check for duplicate reference (idempotency)
        const existingTx = await prisma.transaction.findFirst({
            where: { reference, walletId },
        });

        if (existingTx) {
            console.log('[Wallet] Duplicate transaction reference, returning existing', { reference });
            // Return in same format as new transaction for consistency
            const existingWallet = await prisma.wallet.findUnique({ where: { id: walletId } });
            return { wallet: existingWallet!, transaction: existingTx };
        }

        // Get user ID and tenant ID for the wallet
        const walletWithUser = await prisma.wallet.findUnique({
            where: { id: walletId },
            include: { user: { select: { id: true } } },
        });

        if (!walletWithUser) {
            throw new AppError(404, 'Wallet not found');
        }

        const userId = walletWithUser.user?.id;
        const tenantId = walletWithUser.tenantId;

        const result = await prisma.$transaction(async (tx) => {
            // Update wallet balance
            const wallet = await tx.wallet.update({
                where: { id: walletId },
                data: {
                    balance: { increment: amount },
                },
            });

            // Create transaction record
            const transaction = await tx.transaction.create({
                data: {
                    tenantId,
                    walletId,
                    amount,
                    type: 'CREDIT',
                    status: 'COMPLETED',
                    reference,
                    description: description || 'Wallet credited',
                },
            });

            // Write domain event for downstream processing
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId,
                    eventType: 'WALLET.CREDITED',
                    aggregateType: 'Wallet',
                    aggregateId: walletId,
                    queueName: 'payments',
                    payload: JSON.stringify({
                        walletId,
                        transactionId: transaction.id,
                        amount,
                        newBalance: wallet.balance,
                        reference,
                        source,
                        gatewayResponse,
                    }),
                },
            });

            return { wallet, transaction };
        });

        // Publish WALLET_CREDITED event to SNS for async processing
        if (userId) {
            try {
                await paymentPublisher.publishWalletCredited({
                    walletId,
                    userId,
                    transactionId: result.transaction.id,
                    amount,
                    currency: result.wallet.currency,
                    newBalance: result.wallet.balance,
                    reference,
                    source,
                });
            } catch (error) {
                // Log but don't fail the credit operation if publishing fails
                console.error('[Wallet] Failed to publish WALLET_CREDITED event', {
                    walletId,
                    error: error instanceof Error ? error.message : error,
                });
            }
        }

        return result;
    }

    /**
     * Debit wallet (remove funds)
     * Called when:
     * - Paying for installments
     * - Transfer out
     */
    async debit(input: DebitWalletInput) {
        const { walletId, amount, reference, description } = input;

        if (amount <= 0) {
            throw new AppError(400, 'Debit amount must be positive');
        }

        const wallet = await this.findById(walletId);
        const tenantId = wallet.tenantId;

        if (wallet.balance < amount) {
            throw new AppError(400, `Insufficient balance. Available: ${wallet.balance}, Required: ${amount}`);
        }

        // Check for duplicate reference (idempotency)
        const existingTx = await prisma.transaction.findFirst({
            where: { reference, walletId, type: 'DEBIT' },
        });

        if (existingTx) {
            console.log('[Wallet] Duplicate debit reference, returning existing', { reference });
            const existingWallet = await prisma.wallet.findUnique({ where: { id: walletId } });
            return { wallet: existingWallet!, transaction: existingTx };
        }

        const result = await prisma.$transaction(async (tx) => {
            // Update wallet balance
            const updatedWallet = await tx.wallet.update({
                where: { id: walletId },
                data: {
                    balance: { decrement: amount },
                },
            });

            // Create transaction record
            const transaction = await tx.transaction.create({
                data: {
                    tenantId,
                    walletId,
                    amount,
                    type: 'DEBIT',
                    status: 'COMPLETED',
                    reference,
                    description: description || 'Wallet debited',
                },
            });

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId,
                    eventType: 'WALLET.DEBITED',
                    aggregateType: 'Wallet',
                    aggregateId: walletId,
                    queueName: 'payments',
                    payload: JSON.stringify({
                        walletId,
                        transactionId: transaction.id,
                        amount,
                        newBalance: updatedWallet.balance,
                        reference,
                    }),
                },
            });

            return { wallet: updatedWallet, transaction };
        });

        return result;
    }

    /**
     * Process BudPay virtual account webhook
     * This is called when a user pays into their virtual account
     */
    async processBudPayWebhook(payload: BudPayWebhookPayload, signature: string): Promise<any> {
        // TODO: Verify webhook signature using BudPay secret key
        // const isValid = this.verifyBudPaySignature(payload, signature);
        // if (!isValid) throw new AppError(401, 'Invalid webhook signature');

        const { event, data } = payload;

        // Only process credit events
        if (event !== 'virtualaccount.credit' && event !== 'collection.successful') {
            console.log('[BudPay Webhook] Ignoring event type:', event);
            return { status: 'ignored', event };
        }

        if (data.status !== 'successful' && data.status !== 'success') {
            console.log('[BudPay Webhook] Ignoring non-successful transaction:', data.status);
            return { status: 'ignored', reason: 'non-successful' };
        }

        // BudPay amounts are in kobo (minor units), convert to naira
        const amountInNaira = data.amount / 100;

        // Find user by email with their tenant memberships
        const user = await prisma.user.findUnique({
            where: { email: data.customer.email },
            include: {
                tenantMemberships: {
                    where: { isDefault: true },
                    select: { tenantId: true },
                    take: 1,
                },
            },
        });

        if (!user) {
            console.error('[BudPay Webhook] User not found for email:', data.customer.email);
            throw new AppError(404, `User not found: ${data.customer.email}`);
        }

        // Get user's default tenant
        const tenantId = user.tenantMemberships[0]?.tenantId;
        if (!tenantId) {
            console.error('[BudPay Webhook] User has no primary tenant:', data.customer.email);
            throw new AppError(400, `User has no tenant membership: ${data.customer.email}`);
        }

        // Ensure user has a wallet
        let walletId = user.walletId;
        if (!walletId) {
            const wallet = await this.createForUser(user.id, tenantId, data.currency);
            walletId = wallet.id;
        }

        // Credit the wallet
        const { wallet, transaction } = await this.credit({
            walletId,
            amount: amountInNaira,
            reference: data.reference,
            description: `Virtual account credit from ${data.account.bank_name}`,
            gatewayResponse: data as any,
            source: 'virtual_account',
        });

        console.log('[BudPay Webhook] Wallet credited successfully', {
            userId: user.id,
            walletId,
            amount: amountInNaira,
            newBalance: wallet.balance,
            reference: data.reference,
        });

        return {
            status: 'processed',
            transactionId: transaction.id,
            walletId,
            userId: user.id,
            amount: amountInNaira,
            newBalance: wallet.balance,
        };
    }

    /**
     * Get transaction history for a wallet
     */
    async getTransactions(walletId: string, limit: number = 50, offset: number = 0) {
        const transactions = await prisma.transaction.findMany({
            where: { walletId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });

        const total = await prisma.transaction.count({
            where: { walletId },
        });

        return { transactions, total, limit, offset };
    }

    /**
     * Verify BudPay webhook signature
     * Uses HMAC-SHA512 with secret key
     */
    private verifyBudPaySignature(payload: any, signature: string): boolean {
        // TODO: Implement when we have the secret key
        // const crypto = require('crypto');
        // const secret = process.env.BUDPAY_SECRET_KEY;
        // const hash = crypto.createHmac('sha512', secret)
        //     .update(JSON.stringify(payload))
        //     .digest('hex');
        // return hash === signature;
        return true; // For now, trust the payload
    }
}

export const walletService = new WalletService();
