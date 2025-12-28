import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { MortgageDownpaymentPlan } from './mortgage-downpayment.entity';
import { MortgageDownpaymentInstallment } from './mortgage-downpayment-installment.entity';
import { User } from './user.entity';

// Legacy enum - kept for backward compatibility
export enum DownpaymentPaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

// Payment state for FSM tracking
export enum PaymentState {
    INITIATED = 'INITIATED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

@Entity({ name: 'mortgage_downpayment_payment' })
export class MortgageDownpaymentPayment extends AbstractBaseEntity {
    @ManyToOne(() => MortgageDownpaymentPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id' })
    plan: MortgageDownpaymentPlan;

    @Column({ name: 'plan_id', nullable: true })
    planId: number;

    @ManyToOne(() => MortgageDownpaymentInstallment, { nullable: true })
    @JoinColumn({ name: 'installment_id' })
    installment: MortgageDownpaymentInstallment;

    @Column({ name: 'installment_id', nullable: true })
    installmentId: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'payer_id' })
    payer: User;

    @Column({ name: 'payer_id', nullable: true })
    payerId: number;

    @Column({ name: 'amount', type: 'double precision' })
    amount: number;

    @Column({ name: 'provider_reference', nullable: true, unique: true })
    providerReference: string;

    @Column({ name: 'status', type: 'enum', enum: DownpaymentPaymentStatus, default: DownpaymentPaymentStatus.PENDING })
    status: DownpaymentPaymentStatus;

    // FSM state tracking
    @Column({ name: 'state', type: 'enum', enum: PaymentState, default: PaymentState.INITIATED })
    state: PaymentState;

    @Column({ name: 'state_metadata', type: 'text', nullable: true })
    stateMetadata: string; // JSON metadata for state transitions
}

export default MortgageDownpaymentPayment;
