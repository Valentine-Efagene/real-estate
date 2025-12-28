import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Property } from './property.entity';
import { User } from './user.entity';
import PaymentSchedule from './payment-schedule.entity';
import Contract from './contract.entity';

/**
 * Types of payment plans
 */
export enum PlanType {
    MORTGAGE = 'MORTGAGE',                   // Traditional mortgage with downpayment + monthly
    INSTALLMENT = 'INSTALLMENT',             // Simple installment plan (no downpayment)
    RENT_TO_OWN = 'RENT_TO_OWN',            // Rent-to-own plan
    LEASE = 'LEASE',                         // Lease/rental plan
    OUTRIGHT_PURCHASE = 'OUTRIGHT_PURCHASE', // One-time payment
    CUSTOM = 'CUSTOM',                       // Custom payment structure
}

/**
 * FSM States for Payment Plans
 */
export enum PaymentPlanState {
    // Initial States
    DRAFT = 'DRAFT',                         // Being configured
    PENDING_APPROVAL = 'PENDING_APPROVAL',   // Awaiting approval
    APPROVED = 'APPROVED',                   // Approved but not started

    // Active States
    ACTIVE = 'ACTIVE',                       // Plan is active
    CURRENT = 'CURRENT',                     // All payments up to date

    // Issue States
    PARTIALLY_PAID = 'PARTIALLY_PAID',       // Some installments paid
    LATE = 'LATE',                           // Payment overdue
    DELINQUENT = 'DELINQUENT',              // Multiple payments overdue
    DEFAULT = 'DEFAULT',                     // In default

    // Mitigation States
    FORBEARANCE = 'FORBEARANCE',            // Payment pause granted
    RESTRUCTURED = 'RESTRUCTURED',           // Plan modified

    // Terminal States
    COMPLETED = 'COMPLETED',                 // Fully paid
    CANCELLED = 'CANCELLED',                 // Cancelled before completion
    TERMINATED = 'TERMINATED',               // Terminated due to breach
    TRANSFERRED = 'TRANSFERRED',             // Transferred to new plan
}

/**
 * Generic Payment Plan - can represent any type of payment arrangement
 * Supports:
 * - Traditional mortgages (downpayment + monthly installments)
 * - Simple installment plans (no downpayment)
 * - Rent-to-own
 * - Flexible custom payment schedules
 */
@Entity({ name: 'payment_plan' })
export class PaymentPlan extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Property, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ name: 'property_id' })
    propertyId: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'buyer_id' })
    buyer: User;

    @Column({ name: 'buyer_id', nullable: true })
    buyerId: number;

    @Column({ type: 'enum', enum: PlanType })
    planType: PlanType;

    @Column({ type: 'varchar', length: 255 })
    name: string; // e.g., "24-Month Installment Plan", "Standard Mortgage"

    @Column({ type: 'text', nullable: true })
    description: string;

    // Financial Details
    @Column({ name: 'total_amount', type: 'double precision' })
    totalAmount: number; // Total price/loan amount

    @Column({ name: 'down_payment_amount', type: 'double precision', default: 0 })
    downPaymentAmount: number; // Can be 0 for installment-only plans

    @Column({ name: 'down_payment_paid', type: 'double precision', default: 0 })
    downPaymentPaid: number;

    @Column({ name: 'principal_amount', type: 'double precision' })
    principalAmount: number; // Amount to be paid in installments (total - downpayment)

    @Column({ name: 'interest_rate', type: 'double precision', nullable: true })
    interestRate: number; // Annual interest rate (can be 0 or null)

    @Column({ name: 'total_interest', type: 'double precision', default: 0 })
    totalInterest: number; // Calculated total interest

    @Column({ name: 'total_payable', type: 'double precision' })
    totalPayable: number; // principal + interest

    @Column({ name: 'total_paid', type: 'double precision', default: 0 })
    totalPaid: number; // Total amount paid so far

    @Column({ name: 'balance_remaining', type: 'double precision' })
    balanceRemaining: number; // Amount still owed

    // Dates
    @Column({ name: 'start_date', type: 'date', nullable: true })
    startDate: Date;

    @Column({ name: 'end_date', type: 'date', nullable: true })
    endDate: Date;

    @Column({ name: 'maturity_date', type: 'date', nullable: true })
    maturityDate: Date; // Expected completion date

    @Column({ name: 'first_payment_date', type: 'date', nullable: true })
    firstPaymentDate: Date;

    // FSM State Management
    @Column({ type: 'varchar', default: PaymentPlanState.DRAFT })
    state: string;

    @Column({ name: 'state_metadata', type: 'text', nullable: true })
    stateMetadata: string; // JSON: transition history, context

    // Relations
    @OneToMany(() => PaymentSchedule, (schedule) => schedule.paymentPlan, { cascade: true })
    schedules: PaymentSchedule[];

    @OneToOne(() => Contract, (contract) => contract.paymentPlan, { nullable: true })
    contract: Contract;

    @Column({ name: 'contract_id', nullable: true })
    contractId: number;

    // Additional metadata
    @Column({ type: 'json', nullable: true })
    metadata: any; // Flexible field for plan-specific data

    @Column({ name: 'last_payment_date', type: 'timestamp', nullable: true })
    lastPaymentDate: Date;

    @Column({ name: 'next_payment_date', type: 'date', nullable: true })
    nextPaymentDate: Date;

    @Column({ name: 'last_reminder_sent_at', type: 'timestamp', nullable: true })
    lastReminderSentAt: Date;
}

export default PaymentPlan;
