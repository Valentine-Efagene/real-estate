import { prisma } from '../lib/prisma';
import { AppError, PaymentEventPublisher, PaymentEventType } from '@valentine-efagene/qshelter-common';
import { walletService } from './wallet.service';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Allocation Service
// =============================================================================
// Handles automatic allocation of wallet funds to pending installments.
// Triggered by WALLET.CREDITED events or manual allocation commands.
// =============================================================================

const paymentPublisher = new PaymentEventPublisher('payment-service');

interface AllocationOptions {
    applicationId?: string;
    maxAmount?: number;
}

interface PayInstallmentInput {
    installmentId: string;
    amount: number;
    walletId: string;
    userId: string;
    reference: string;
}

interface AllocationResult {
    totalAllocated: number;
    installmentsPaid: Array<{
        installmentId: string;
        amount: number;
        status: 'PAID' | 'PARTIALLY_PAID';
    }>;
    remainingBalance: number;
}

class AllocationService {
    /**
     * Auto-allocate wallet funds to pending/overdue installments
     * Prioritizes overdue, then pending, ordered by due date
     */
    async autoAllocateToPendingInstallments(
        userId: string,
        walletId: string,
        options?: AllocationOptions
    ): Promise<AllocationResult> {
        const wallet = await walletService.findById(walletId);

        if (wallet.balance <= 0) {
            console.log('[Allocation] No balance to allocate', { userId, walletId });
            return { totalAllocated: 0, installmentsPaid: [], remainingBalance: 0 };
        }

        let availableBalance = options?.maxAmount
            ? Math.min(wallet.balance, options.maxAmount)
            : wallet.balance;

        // Find user's applications
        const applications = await prisma.application.findMany({
            where: {
                buyerId: userId,
                status: 'ACTIVE', // Only active applications (arrears tracked at installment level)
                ...(options?.applicationId ? { id: options.applicationId } : {}),
            },
            select: { id: true },
        });

        if (applications.length === 0) {
            console.log('[Allocation] No active applications for user', { userId });
            return { totalAllocated: 0, installmentsPaid: [], remainingBalance: wallet.balance };
        }

        const applicationIds = applications.map((c) => c.id);

        // Find phases for these applications
        const phases = await prisma.applicationPhase.findMany({
            where: {
                applicationId: { in: applicationIds },
                status: { in: ['ACTIVE', 'PENDING'] },
            },
            select: { id: true },
        });

        if (phases.length === 0) {
            console.log('[Allocation] No active phases for applications', { userId, applicationIds });
            return { totalAllocated: 0, installmentsPaid: [], remainingBalance: wallet.balance };
        }

        const phaseIds = phases.map((p) => p.id);

        // Find pending/overdue installments ordered by priority
        const installments = await prisma.paymentInstallment.findMany({
            where: {
                paymentPhaseId: { in: phaseIds },
                status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] },
            },
            orderBy: [
                { status: 'asc' }, // OVERDUE first
                { dueDate: 'asc' }, // Earliest due date
            ],
        });

        if (installments.length === 0) {
            console.log('[Allocation] No pending installments', { userId });
            return { totalAllocated: 0, installmentsPaid: [], remainingBalance: wallet.balance };
        }

        console.log('[Allocation] Found pending installments', {
            userId,
            count: installments.length,
            availableBalance,
        });

        const result: AllocationResult = {
            totalAllocated: 0,
            installmentsPaid: [],
            remainingBalance: availableBalance,
        };

        // Allocate funds to each installment
        for (const installment of installments) {
            if (availableBalance <= 0) break;

            const amountOwed = installment.amount - installment.paidAmount;
            if (amountOwed <= 0) continue;

            const paymentAmount = Math.min(availableBalance, amountOwed);
            const reference = `AUTO-${uuidv4().substring(0, 8)}`;

            try {
                await this.payInstallment({
                    installmentId: installment.id,
                    amount: paymentAmount,
                    walletId,
                    userId,
                    reference,
                });

                const newPaidAmount = installment.paidAmount + paymentAmount;
                const isPaid = newPaidAmount >= installment.amount;

                result.installmentsPaid.push({
                    installmentId: installment.id,
                    amount: paymentAmount,
                    status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
                });

                result.totalAllocated += paymentAmount;
                availableBalance -= paymentAmount;

                console.log('[Allocation] Paid installment', {
                    installmentId: installment.id,
                    amount: paymentAmount,
                    status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
                    remainingBalance: availableBalance,
                });
            } catch (error) {
                console.error('[Allocation] Failed to pay installment', {
                    installmentId: installment.id,
                    error: error instanceof Error ? error.message : error,
                });
                // Continue with next installment
            }
        }

        result.remainingBalance = availableBalance;

        console.log('[Allocation] Allocation complete', {
            userId,
            totalAllocated: result.totalAllocated,
            installmentsPaid: result.installmentsPaid.length,
            remainingBalance: result.remainingBalance,
        });

        return result;
    }

    /**
     * Pay a specific installment from wallet
     * Debits wallet and updates installment/phase records
     */
    async payInstallment(input: PayInstallmentInput): Promise<void> {
        const { installmentId, amount, walletId, userId, reference } = input;

        // Verify installment exists
        const installment = await prisma.paymentInstallment.findUnique({
            where: { id: installmentId },
            include: { paymentPhase: { include: { phase: true } } },
        });

        if (!installment) {
            throw new AppError(404, 'Installment not found');
        }

        if (!installment.paymentPhase) {
            throw new AppError(400, 'Installment is not associated with a phase');
        }

        const paymentPhase = installment.paymentPhase;
        const applicationPhase = paymentPhase.phase;

        // Debit wallet
        const { wallet, transaction } = await walletService.debit({
            walletId,
            amount,
            reference,
            description: `Payment for installment ${installment.installmentNumber}`,
        });

        // Update installment and phase in a transaction
        await prisma.$transaction(async (tx) => {
            const newPaidAmount = installment.paidAmount + amount;
            const isPaid = newPaidAmount >= installment.amount;

            // Update installment
            await tx.paymentInstallment.update({
                where: { id: installmentId },
                data: {
                    paidAmount: newPaidAmount,
                    status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
                    paidDate: isPaid ? new Date() : null,
                },
            });

            // Update phase totals
            const newPhasePaidAmount = paymentPhase.paidAmount + amount;
            const newRemainingAmount = (paymentPhase.totalAmount ?? 0) - newPhasePaidAmount;
            const isPhaseComplete = newRemainingAmount <= 0;

            await tx.paymentPhase.update({
                where: { id: paymentPhase.id },
                data: {
                    paidAmount: newPhasePaidAmount,
                },
            });

            // Update parent ApplicationPhase status if complete
            if (isPhaseComplete) {
                await tx.applicationPhase.update({
                    where: { id: paymentPhase.phaseId },
                    data: {
                        status: 'COMPLETED',
                        completedAt: new Date(),
                    },
                });
            }

            // Get tenantId from the application phase
            const tenantId = applicationPhase.tenantId;

            // Create payment record
            await tx.applicationPayment.create({
                data: {
                    tenantId,
                    applicationId: applicationPhase.applicationId,
                    phaseId: applicationPhase.id,
                    installmentId,
                    payerId: userId,
                    amount,
                    paymentMethod: 'WALLET',
                    status: 'COMPLETED',
                    reference,
                    processedAt: new Date(),
                },
            });

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId,
                    eventType: 'PAYMENT.COMPLETED',
                    aggregateType: 'ApplicationPayment',
                    aggregateId: installmentId,
                    queueName: 'payments',
                    payload: JSON.stringify({
                        installmentId,
                        phaseId: applicationPhase.id,
                        applicationId: applicationPhase.applicationId,
                        amount,
                        reference,
                        walletId,
                        transactionId: transaction.id,
                    }),
                    actorId: userId,
                },
            });
        });

        console.log('[Allocation] Installment payment complete', {
            installmentId,
            amount,
            reference,
            newWalletBalance: wallet.balance,
        });
    }
}

export const allocationService = new AllocationService();
