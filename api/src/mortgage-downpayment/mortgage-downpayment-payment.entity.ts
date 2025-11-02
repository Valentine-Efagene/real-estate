import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from '../common/common.pure.entity';
import { MortgageDownpaymentPlan } from './mortgage-downpayment.entity';
import { MortgageDownpaymentInstallment } from './mortgage-downpayment-installment.entity';
import { User } from '../user/user.entity';

export enum DownpaymentPaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

@Entity({ name: 'mortgage_downpayment_payment' })
export class MortgageDownpaymentPayment extends AbstractBaseEntity {
    @ManyToOne(() => MortgageDownpaymentPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id' })
    plan: MortgageDownpaymentPlan;

    @Column({ nullable: true })
    planId: number;

    @ManyToOne(() => MortgageDownpaymentInstallment, { nullable: true })
    @JoinColumn({ name: 'installment_id' })
    installment: MortgageDownpaymentInstallment;

    @Column({ nullable: true })
    installmentId: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'payer_id' })
    payer: User;

    @Column({ nullable: true })
    payerId: number;

    @Column({ type: 'double precision' })
    amount: number;

    @Column({ nullable: true, unique: true })
    providerReference: string;

    @Column({ type: 'enum', enum: DownpaymentPaymentStatus, default: DownpaymentPaymentStatus.PENDING })
    status: DownpaymentPaymentStatus;
}

export default MortgageDownpaymentPayment;
