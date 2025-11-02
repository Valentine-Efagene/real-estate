import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import TransactionEntity, { TransactionStatus } from './transaction.entity';
import { MortgageDownpaymentPlan, DownpaymentPlanStatus } from '../mortgage-downpayment/mortgage-downpayment.entity';
import { MortgageDownpaymentInstallment, InstallmentStatus } from '../mortgage-downpayment/mortgage-downpayment-installment.entity';
import { MortgageDownpaymentPayment, DownpaymentPaymentStatus } from '../mortgage-downpayment/mortgage-downpayment-payment.entity';
import { Mortgage } from '../mortgage/mortgage.entity';
import { User } from '../user/user.entity';

@Injectable()
export class PaymentReconciliationService {
    private readonly logger = new Logger(PaymentReconciliationService.name);

    constructor(
        @InjectRepository(TransactionEntity)
        private transactionRepo: Repository<TransactionEntity>,

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
     * Reconcile a single transaction by providerReference (or id).
     * - idempotent: checks existing providerReference in payments
     * - locked: acquires pessimistic locks on installments
     */
    async reconcileTransactionById(transactionId: number) {
        const tx = await this.transactionRepo.findOneBy({ id: transactionId });
        if (!tx) throw new Error('Transaction not found');
        return this.reconcileTransaction(tx);
    }

    async reconcileTransaction(tx: TransactionEntity) {
        // quick idempotency: if already reconciled, skip
        if (tx.status === TransactionStatus.RECONCILED) {
            return { status: 'already_reconciled' };
        }

        // If providerReference already exists as a processed payment, skip
        if (tx.providerReference) {
            const existed = await this.paymentRepo.findOne({ where: { providerReference: tx.providerReference } });
            if (existed) {
                await this.transactionRepo.update(tx.id, { status: TransactionStatus.RECONCILED, reconciledAt: new Date() });
                return { status: 'already_processed' };
            }
        }

        // Resolve payer using userId only (virtualAccountId mapping not present on User entity here)
        let payer: User = null;
        if (tx.userId) payer = await this.userRepo.findOneBy({ id: tx.userId });

        if (!payer) {
            // Mark as unmatched so a manual process can resolve
            await this.transactionRepo.update(tx.id, { status: TransactionStatus.UNMATCHED });
            this.logger.warn(`Transaction ${tx.id} unmatched (no payer)`);
            return { status: 'unmatched' };
        }

        // Find the active downpayment plan for this user's mortgage(s)
        // join mortgage -> borrowerId
        const plan = await this.planRepo.createQueryBuilder('plan')
            .leftJoinAndSelect('plan.mortgage', 'mortgage')
            .leftJoinAndSelect('plan.installments', 'installments')
            .where('mortgage.borrower_id = :borrowerId', { borrowerId: payer.id })
            .andWhere('plan.status = :status', { status: DownpaymentPlanStatus.ACTIVE })
            .orderBy('plan.created_at', 'ASC')
            .getOne();
        if (!plan) {
            await this.transactionRepo.update(tx.id, { status: TransactionStatus.UNMATCHED });
            this.logger.warn(`Transaction ${tx.id} unmatched (no active plan for user ${payer.id})`);
            return { status: 'no_plan' };
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            // Re-check idempotency inside transaction
            if (tx.providerReference) {
                const existingInside = await queryRunner.manager.findOne(MortgageDownpaymentPayment, { where: { providerReference: tx.providerReference } });
                if (existingInside) {
                    await queryRunner.rollbackTransaction();
                    await this.transactionRepo.update(tx.id, { status: TransactionStatus.RECONCILED, reconciledAt: new Date() });
                    return { status: 'already_processed' };
                }
            }

            // Lock unpaid installments
            const unpaidInstallments = await queryRunner.manager
                .createQueryBuilder(MortgageDownpaymentInstallment, 'inst')
                .setLock('pessimistic_write')
                .where('inst.plan_id = :planId', { planId: plan.id })
                .andWhere('inst.amount_paid < inst.amount_due')
                .orderBy('inst.sequence', 'ASC')
                .getMany();

            let remaining = Number(tx.amount || 0);
            const paymentsSaved = [];

            for (const inst of unpaidInstallments) {
                if (remaining <= 0) break;
                const due = Number(inst.amountDue) - Number(inst.amountPaid || 0);
                const apply = Math.min(due, remaining);
                if (apply <= 0) continue;

                inst.amountPaid = Number((Number(inst.amountPaid || 0) + apply).toFixed(2));
                if (inst.amountPaid >= inst.amountDue) {
                    inst.status = InstallmentStatus.PAID;
                    inst.paidAt = new Date();
                } else {
                    inst.status = InstallmentStatus.PARTIAL;
                }

                await queryRunner.manager.save(inst);

                const payment = this.paymentRepo.create({
                    planId: plan.id,
                    installmentId: inst.id,
                    payerId: payer.id,
                    amount: apply,
                    providerReference: tx.providerReference,
                    status: DownpaymentPaymentStatus.COMPLETED,
                });
                await queryRunner.manager.save(payment as any);
                paymentsSaved.push(payment);

                remaining = Number((remaining - apply).toFixed(2));
            }

            // Handle leftover -> unappliedBalance on plan
            if (remaining > 0) {
                (plan as any).unappliedBalance = (Number((plan as any).unappliedBalance || 0) + remaining);
            }

            // Update plan/mortgage paid totals
            const totalApplied = Number(tx.amount) - remaining;
            if (totalApplied > 0) {
                (plan as any).downpaymentPaid = (Number((plan as any).downpaymentPaid || 0) + totalApplied);
                await queryRunner.manager.save(plan as any);
                if (plan.mortgageId) {
                    await queryRunner.manager.increment(Mortgage, { id: plan.mortgageId }, 'downPaymentPaid', totalApplied);
                }
            }

            // If all installments fully paid, mark plan complete
            const remainingCount = await queryRunner.manager.createQueryBuilder(MortgageDownpaymentInstallment, 'inst')
                .where('inst.plan_id = :planId', { planId: plan.id })
                .andWhere('inst.amount_paid < inst.amount_due')
                .getCount();

            if (remainingCount === 0) {
                plan.status = DownpaymentPlanStatus.COMPLETED;
                await queryRunner.manager.save(plan as any);
            }

            // Mark transaction reconciled
            await queryRunner.manager.update(TransactionEntity, { id: tx.id }, { status: TransactionStatus.RECONCILED, reconciledAt: new Date() });

            await queryRunner.commitTransaction();
            return { status: 'processed', applied: totalApplied, leftover: remaining, payments: paymentsSaved };
        } catch (err) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Reconcile failed', err as any);
            throw err;
        } finally {
            await queryRunner.release();
        }
    }
}

export default PaymentReconciliationService;
