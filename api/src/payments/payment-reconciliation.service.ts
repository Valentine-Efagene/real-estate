import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Transaction } from '../transaction/transaction.entity';
import { Wallet } from '../wallet/wallet.entity';
import { MortgageDownpaymentPlan, DownpaymentPlanStatus } from '../mortgage-downpayment/mortgage-downpayment.entity';
import { MortgageDownpaymentInstallment, InstallmentStatus } from '../mortgage-downpayment/mortgage-downpayment-installment.entity';
import { MortgageDownpaymentPayment, DownpaymentPaymentStatus } from '../mortgage-downpayment/mortgage-downpayment-payment.entity';
import { Mortgage } from '../mortgage/mortgage.entity';
import { User } from '../user/user.entity';

@Injectable()
export class PaymentReconciliationService {
    private readonly logger = new Logger(PaymentReconciliationService.name);

    constructor(
        @InjectRepository(Transaction)
        private transactionRepo: Repository<Transaction>,

        @InjectRepository(Wallet)
        private walletRepo: Repository<Wallet>,

        @InjectRepository(MortgageDownpaymentPlan)
        private planRepo: Repository<MortgageDownpaymentPlan>,

        @InjectRepository(MortgageDownpaymentInstallment)
        private installmentRepo: Repository<MortgageDownpaymentInstallment>,

        @InjectRepository(MortgageDownpaymentPayment)
        private paymentRepo: Repository<MortgageDownpaymentPayment>,

        @InjectRepository(Mortgage)
        private mortgageRepo: Repository<Mortgage>,

        @InjectRepository(User)
        private userRepo: Repository<User>,

        private dataSource: DataSource,
    ) { }

    /**
     * Process downpayment from wallet transaction.
     * Called when wallet balance is debited for mortgage downpayment.
     */
    async processDownpaymentFromWallet(userId: number, amount: number, transactionRef: string) {
        // Check if already processed
        const existingPayment = await this.paymentRepo.findOne({ where: { providerReference: transactionRef } });
        if (existingPayment) {
            return { status: 'already_processed', payment: existingPayment };
        }

        // Find user's active downpayment plan
        const plan = await this.planRepo.createQueryBuilder('plan')
            .leftJoinAndSelect('plan.mortgage', 'mortgage')
            .leftJoinAndSelect('plan.installments', 'installments')
            .where('mortgage.borrower_id = :borrowerId', { borrowerId: userId })
            .andWhere('plan.status = :status', { status: DownpaymentPlanStatus.ACTIVE })
            .orderBy('plan.created_at', 'ASC')
            .getOne();

        if (!plan) {
            this.logger.warn(`No active downpayment plan found for user ${userId}`);
            return { status: 'no_plan' };
        }

        return this.allocatePaymentToInstallments(plan, userId, amount, transactionRef);
    }

    /**
     * Allocate payment amount across unpaid installments
     */
    private async allocatePaymentToInstallments(
        plan: MortgageDownpaymentPlan,
        payerId: number,
        amount: number,
        transactionRef: string
    ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Re-check idempotency inside transaction
            const existingPayment = await queryRunner.manager.findOne(MortgageDownpaymentPayment, {
                where: { providerReference: transactionRef }
            });

            if (existingPayment) {
                await queryRunner.rollbackTransaction();
                return { status: 'already_processed', payment: existingPayment };
            }

            // Get unpaid installments with pessimistic lock
            const unpaidInstallments = await queryRunner.manager.find(MortgageDownpaymentInstallment, {
                where: { planId: plan.id },
                order: { sequence: 'ASC' },
                lock: { mode: 'pessimistic_write' }
            });

            // Filter to installments that still need payment
            const installmentsNeedingPayment = unpaidInstallments.filter(i =>
                Number(i.amountPaid || 0) < Number(i.amountDue)
            );

            this.logger.debug(`Found ${installmentsNeedingPayment.length} installments needing payment for plan ${plan.id}`);

            let remaining = Number(amount);
            const paymentsSaved = [];

            // Allocate payment across installments
            for (const inst of installmentsNeedingPayment) {
                if (remaining <= 0) break;

                const due = Number(inst.amountDue) - Number(inst.amountPaid || 0);
                const apply = Math.min(due, remaining);
                if (apply <= 0) continue;

                const newAmountPaid = Number((Number(inst.amountPaid || 0) + apply).toFixed(2));
                const newStatus = newAmountPaid >= inst.amountDue ? InstallmentStatus.PAID : InstallmentStatus.PARTIAL;
                const paidAt = newAmountPaid >= inst.amountDue ? new Date() : inst.paidAt;

                this.logger.debug(`Updating installment ${inst.id}: ${inst.amountPaid || 0} -> ${newAmountPaid}, status: ${inst.status} -> ${newStatus}`);

                // Update installment
                await queryRunner.manager.update(MortgageDownpaymentInstallment, { id: inst.id }, {
                    amountPaid: newAmountPaid,
                    status: newStatus,
                    paidAt: paidAt
                });

                remaining = Number((remaining - apply).toFixed(2));

                // Create payment record only for the first installment (one payment per transaction)
                if (paymentsSaved.length === 0) {
                    const payment = this.paymentRepo.create({
                        planId: plan.id,
                        installmentId: inst.id, // first installment touched
                        payerId: payerId,
                        amount: Number(amount), // full transaction amount
                        providerReference: transactionRef,
                        status: DownpaymentPaymentStatus.COMPLETED,
                    });
                    await queryRunner.manager.save(payment);
                    paymentsSaved.push(payment);
                }
            }

            // Update plan/mortgage totals
            const totalApplied = Number(amount) - remaining;
            if (totalApplied > 0) {
                if (plan.mortgageId) {
                    await queryRunner.manager.increment(Mortgage, { id: plan.mortgageId }, 'downPaymentPaid', totalApplied);
                }
            }

            // Check if plan is complete
            const remainingCount = await queryRunner.manager.createQueryBuilder(MortgageDownpaymentInstallment, 'inst')
                .where('inst.planId = :planId', { planId: plan.id })
                .andWhere('inst.amountPaid < inst.amountDue')
                .getCount();

            if (remainingCount === 0) {
                await queryRunner.manager.update(MortgageDownpaymentPlan, { id: plan.id }, {
                    status: DownpaymentPlanStatus.COMPLETED
                });
            }

            await queryRunner.commitTransaction();
            return { status: 'processed', applied: totalApplied, leftover: remaining, payments: paymentsSaved };

        } catch (err) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Payment allocation failed', err);
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Legacy method for backward compatibility - now delegates to wallet-based flow
     */
    async reconcileTransactionById(transactionId: number) {
        const tx = await this.transactionRepo.findOne({
            where: { id: transactionId },
            relations: ['wallet', 'user']
        });

        if (!tx) throw new Error('Transaction not found');

        // Process as wallet-based downpayment
        return this.processDownpaymentFromWallet(tx.userId, Number(tx.amount), tx.ref);
    }
}

export default PaymentReconciliationService;