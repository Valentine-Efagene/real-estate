import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { PaymentPlan } from './payment-plan.entity';
import { Frequency } from '../types/common.type';
import PaymentInstallment from './payment-installment.entity';

/**
 * Types of payment schedules within a plan
 */
export enum ScheduleType {
    DOWNPAYMENT = 'DOWNPAYMENT',           // Downpayment schedule (can be single or installments)
    PRINCIPAL = 'PRINCIPAL',                // Main repayment schedule
    MONTHLY = 'MONTHLY',                    // Monthly payments
    BALLOON = 'BALLOON',                    // Balloon payment at end
    CUSTOM = 'CUSTOM',                      // Custom schedule
}

/**
 * Payment Schedule Status
 */
export enum ScheduleStatus {
    PENDING = 'PENDING',                    // Not yet started
    ACTIVE = 'ACTIVE',                      // Currently active
    COMPLETED = 'COMPLETED',                // All installments paid
    DEFAULTED = 'DEFAULTED',                // Defaulted
    CANCELLED = 'CANCELLED',                // Cancelled
    SUSPENDED = 'SUSPENDED',                // Temporarily suspended
}

/**
 * PaymentSchedule - A collection of installments within a payment plan
 * Examples:
 * - Downpayment schedule: 3 monthly installments of $10k each
 * - Principal schedule: 24 monthly installments of $2k each
 * - Balloon payment: 1 installment of $50k at end
 */
@Entity({ name: 'payment_schedule' })
export class PaymentSchedule extends AbstractBaseEntity {
    @ManyToOne(() => PaymentPlan, (plan) => plan.schedules, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payment_plan_id' })
    paymentPlan: PaymentPlan;

    @Column({ name: 'payment_plan_id' })
    paymentPlanId: number;

    @Column({ type: 'enum', enum: ScheduleType })
    scheduleType: ScheduleType;

    @Column({ type: 'varchar', length: 255 })
    name: string; // e.g., "Downpayment Schedule", "Monthly Installments"

    @Column({ type: 'text', nullable: true })
    description: string;

    // Schedule Details
    @Column({ name: 'total_amount', type: 'double precision' })
    totalAmount: number; // Total amount for this schedule

    @Column({ name: 'installment_count', type: 'int' })
    installmentCount: number; // Number of installments

    @Column({ name: 'installment_amount', type: 'double precision' })
    installmentAmount: number; // Amount per installment (can vary per installment)

    @Column({ type: 'enum', enum: Frequency, nullable: true })
    frequency: Frequency; // MONTHLY, WEEKLY, YEARLY, ONE_TIME, etc.

    // Dates
    @Column({ name: 'start_date', type: 'date' })
    startDate: Date;

    @Column({ name: 'end_date', type: 'date', nullable: true })
    endDate: Date;

    @Column({ name: 'first_due_date', type: 'date' })
    firstDueDate: Date;

    @Column({ name: 'last_due_date', type: 'date', nullable: true })
    lastDueDate: Date;

    // Payment Tracking
    @Column({ name: 'amount_paid', type: 'double precision', default: 0 })
    amountPaid: number;

    @Column({ name: 'amount_remaining', type: 'double precision' })
    amountRemaining: number;

    @Column({ name: 'installments_paid', type: 'int', default: 0 })
    installmentsPaid: number;

    @Column({ name: 'installments_pending', type: 'int' })
    installmentsPending: number;

    @Column({ name: 'installments_overdue', type: 'int', default: 0 })
    installmentsOverdue: number;

    // Status
    @Column({ type: 'enum', enum: ScheduleStatus, default: ScheduleStatus.PENDING })
    status: ScheduleStatus;

    // Relations
    @OneToMany(() => PaymentInstallment, (installment) => installment.schedule, { cascade: true })
    installments: PaymentInstallment[];

    // Metadata
    @Column({ type: 'json', nullable: true })
    metadata: any; // Flexible field for schedule-specific data

    @Column({ name: 'sequence_order', type: 'int', default: 0 })
    sequenceOrder: number; // Order within the plan (e.g., downpayment=1, monthly=2)
}

export default PaymentSchedule;
