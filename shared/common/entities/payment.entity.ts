import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { PaymentInstallment } from './payment-installment.entity';
import { PaymentSchedule } from './payment-schedule.entity';
import { PaymentPlan } from './payment-plan.entity';
import { User } from './user.entity';

/**
 * Payment Status
 */
export enum PaymentStatus {
    INITIATED = 'INITIATED',                // Payment initiated
    PENDING = 'PENDING',                    // Awaiting confirmation
    PROCESSING = 'PROCESSING',              // Being processed
    COMPLETED = 'COMPLETED',                // Successfully completed
    FAILED = 'FAILED',                      // Failed
    CANCELLED = 'CANCELLED',                // Cancelled
    REFUNDED = 'REFUNDED',                  // Refunded
    PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED', // Partially refunded
}

/**
 * Payment Method
 */
export enum PaymentMethod {
    BANK_TRANSFER = 'BANK_TRANSFER',
    CREDIT_CARD = 'CREDIT_CARD',
    DEBIT_CARD = 'DEBIT_CARD',
    WALLET = 'WALLET',
    CASH = 'CASH',
    CHECK = 'CHECK',
    MOBILE_MONEY = 'MOBILE_MONEY',
    CRYPTO = 'CRYPTO',
    OTHER = 'OTHER',
}

/**
 * Payment - Individual payment transaction
 * Can be applied to:
 * - Specific installment
 * - Entire schedule
 * - Multiple installments
 */
@Entity({ name: 'payment' })
export class Payment extends AbstractBaseEntity {
    @ManyToOne(() => PaymentPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payment_plan_id' })
    paymentPlan: PaymentPlan;

    @Column({ name: 'payment_plan_id' })
    paymentPlanId: number;

    @ManyToOne(() => PaymentSchedule, { nullable: true })
    @JoinColumn({ name: 'schedule_id' })
    schedule: PaymentSchedule;

    @Column({ name: 'schedule_id', nullable: true })
    scheduleId: number;

    @ManyToOne(() => PaymentInstallment, (installment) => installment.payments, { nullable: true })
    @JoinColumn({ name: 'installment_id' })
    installment: PaymentInstallment;

    @Column({ name: 'installment_id', nullable: true })
    installmentId: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'payer_id' })
    payer: User;

    @Column({ name: 'payer_id', nullable: true })
    payerId: number;

    // Payment Details
    @Column({ type: 'double precision' })
    amount: number; // Total payment amount

    @Column({ name: 'principal_amount', type: 'double precision', default: 0 })
    principalAmount: number; // Applied to principal

    @Column({ name: 'interest_amount', type: 'double precision', default: 0 })
    interestAmount: number; // Applied to interest

    @Column({ name: 'fee_amount', type: 'double precision', default: 0 })
    feeAmount: number; // Applied to fees

    @Column({ name: 'late_fee_amount', type: 'double precision', default: 0 })
    lateFeeAmount: number; // Applied to late fees

    @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
    method: PaymentMethod;

    @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.INITIATED })
    status: PaymentStatus;

    // Provider/Gateway Details
    @Column({ name: 'provider_reference', nullable: true, unique: true })
    providerReference: string; // External payment reference (Stripe, PayPal, etc.)

    @Column({ name: 'provider_name', nullable: true })
    providerName: string; // Payment provider name

    @Column({ name: 'transaction_id', nullable: true })
    transactionId: string; // Internal transaction ID

    // Dates
    @Column({ name: 'payment_date', type: 'timestamp' })
    paymentDate: Date; // When payment was made/initiated

    @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
    processedAt: Date; // When payment was processed

    @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
    confirmedAt: Date; // When payment was confirmed

    // Additional Info
    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ name: 'receipt_url', nullable: true })
    receiptUrl: string; // URL to receipt/proof

    // FSM State
    @Column({ name: 'state_metadata', type: 'text', nullable: true })
    stateMetadata: string; // JSON: provider response, error details, etc.

    // Metadata
    @Column({ type: 'json', nullable: true })
    metadata: any; // Flexible field for payment-specific data
}

export default Payment;
