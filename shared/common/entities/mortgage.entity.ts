import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Property } from './property.entity';
import { User } from './user.entity';
import MortgageDocument from './mortgage-document.entity';
import MortgageStep from './mortgage-step.entity';
import { MortgageType } from './mortgage-type.entity';
import { MortgageDownpaymentPlan } from './mortgage-downpayment.entity';
import { MortgageState } from '../types/mortgage-fsm.type';

// Legacy enum - kept for backward compatibility
export enum MortgageStatus {
    DRAFT = 'DRAFT',
    PENDING = 'PENDING',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

@Entity({ name: 'mortgage' })
export class Mortgage extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Property, (property) => property.mortgages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ name: 'property_id', nullable: true })
    propertyId: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'borrower_id' })
    borrower: User;

    @Column({ name: 'borrower_id', nullable: true })
    borrowerId: number;

    @Column({ type: 'double precision', nullable: true })
    principal: number;

    @Column({ name: 'down_payment', type: 'double precision', nullable: true })
    downPayment: number;

    @Column({ name: 'term_months', type: 'int', nullable: true })
    termMonths: number;

    @Column({ name: 'interest_rate', type: 'double precision', nullable: true })
    interestRate: number;

    @Column({ name: 'monthly_payment', type: 'double precision', nullable: true })
    monthlyPayment: number;

    @Column({ type: 'enum', enum: MortgageStatus, default: MortgageStatus.DRAFT })
    status: MortgageStatus;

    // FSM State - Primary state tracking
    @Column({ type: 'varchar', default: MortgageState.DRAFT })
    state: string; // Using string to store MortgageState enum values

    // FSM Metadata - Stores transition history and context
    @Column({ name: 'state_metadata', type: 'text', nullable: true })
    stateMetadata: string; // JSON string containing last transition info

    @OneToMany(() => MortgageDocument, (doc) => doc.mortgage)
    documents: MortgageDocument[];

    @OneToMany(() => MortgageStep, (step) => step.mortgage, { cascade: true })
    steps: MortgageStep[];

    @ManyToOne(() => MortgageType, { nullable: true })
    @JoinColumn({ name: 'mortgage_type_id' })
    mortgageType: MortgageType;

    @Column({ name: 'mortgage_type_id', nullable: true })
    mortgageTypeId: number;

    @Column({ name: 'last_reminder_sent_at', type: 'timestamp', nullable: true })
    lastReminderSentAt: Date;

    @OneToOne(() => MortgageDownpaymentPlan, { nullable: true })
    @JoinColumn({ name: 'downpayment_plan_id' })
    downpaymentPlan: MortgageDownpaymentPlan;

    @Column({ name: 'downpayment_plan_id', nullable: true })
    downpaymentPlanId: number;

    @Column({ name: 'down_payment_paid', type: 'double precision', nullable: true })
    downPaymentPaid: number;
}

export default Mortgage;
