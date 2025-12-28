import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { PaymentSchedule } from './payment-schedule.entity';
import Payment from './payment.entity';

/**
 * Installment Status
 */
export enum InstallmentStatus {
    PENDING = 'PENDING',                    // Not yet due or unpaid
    PARTIAL = 'PARTIAL',                    // Partially paid
    PAID = 'PAID',                          // Fully paid
    OVERDUE = 'OVERDUE',                    // Past due date
    LATE = 'LATE',                          // Paid but late
    WAIVED = 'WAIVED',                      // Waived/forgiven
    DEFERRED = 'DEFERRED',                  // Deferred to later date
}

/**
 * PaymentInstallment - Individual payment due within a schedule
 */
@Entity({ name: 'payment_installment' })
export class PaymentInstallment extends AbstractBaseEntity {
    @ManyToOne(() => PaymentSchedule, (schedule) => schedule.installments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'schedule_id' })
    schedule: PaymentSchedule;

    @Column({ name: 'schedule_id' })
    scheduleId: number;

    @Column({ type: 'int' })
    sequence: number; // Installment number (1, 2, 3...)

    @Column({ type: 'varchar', length: 255, nullable: true })
    name: string; // e.g., "Installment 1 of 24"

    // Amount Details
    @Column({ name: 'amount_due', type: 'double precision' })
    amountDue: number; // Total amount due for this installment

    @Column({ name: 'principal_due', type: 'double precision', default: 0 })
    principalDue: number; // Principal portion

    @Column({ name: 'interest_due', type: 'double precision', default: 0 })
    interestDue: number; // Interest portion

    @Column({ name: 'fees_due', type: 'double precision', default: 0 })
    feesDue: number; // Any additional fees

    @Column({ name: 'amount_paid', type: 'double precision', default: 0 })
    amountPaid: number; // Amount paid so far

    @Column({ name: 'principal_paid', type: 'double precision', default: 0 })
    principalPaid: number;

    @Column({ name: 'interest_paid', type: 'double precision', default: 0 })
    interestPaid: number;

    @Column({ name: 'fees_paid', type: 'double precision', default: 0 })
    feesPaid: number;

    @Column({ name: 'amount_remaining', type: 'double precision' })
    amountRemaining: number; // Amount still owed

    @Column({ name: 'late_fee', type: 'double precision', default: 0 })
    lateFee: number; // Late payment penalty

    // Dates
    @Column({ name: 'due_date', type: 'date' })
    dueDate: Date;

    @Column({ name: 'grace_period_end_date', type: 'date', nullable: true })
    gracePeriodEndDate: Date; // Date after which late fees apply

    @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
    paidAt: Date; // When fully paid

    @Column({ name: 'first_payment_at', type: 'timestamp', nullable: true })
    firstPaymentAt: Date; // When first payment was made

    @Column({ name: 'last_payment_at', type: 'timestamp', nullable: true })
    lastPaymentAt: Date; // Most recent payment

    // Status
    @Column({ type: 'enum', enum: InstallmentStatus, default: InstallmentStatus.PENDING })
    status: InstallmentStatus;

    @Column({ name: 'is_overdue', type: 'boolean', default: false })
    isOverdue: boolean;

    @Column({ name: 'days_overdue', type: 'int', default: 0 })
    daysOverdue: number;

    // Relations
    @OneToMany(() => Payment, (payment) => payment.installment)
    payments: Payment[];

    // Metadata
    @Column({ type: 'json', nullable: true })
    metadata: any; // Flexible field for installment-specific data
}

export default PaymentInstallment;
