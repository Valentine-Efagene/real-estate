import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from '../common/common.pure.entity';
import { MortgageDownpaymentPlan } from './mortgage-downpayment.entity';

export enum InstallmentStatus {
    PENDING = 'PENDING',
    PARTIAL = 'PARTIAL',
    PAID = 'PAID',
    LATE = 'LATE',
}

@Entity({ name: 'mortgage_downpayment_installment' })
export class MortgageDownpaymentInstallment extends AbstractBaseEntity {
    @ManyToOne(() => MortgageDownpaymentPlan, (p) => p.installments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plan_id' })
    plan: MortgageDownpaymentPlan;

    @Column({ nullable: true })
    planId: number;

    @Column({ type: 'int' })
    sequence: number;

    @Column({ type: 'date' })
    dueDate: Date;

    @Column({ type: 'double precision' })
    amountDue: number;

    @Column({ type: 'double precision', default: 0 })
    amountPaid: number;

    @Column({ type: 'timestamp', nullable: true })
    paidAt: Date;

    @Column({ type: 'enum', enum: InstallmentStatus, default: InstallmentStatus.PENDING })
    status: InstallmentStatus;
}

export default MortgageDownpaymentInstallment;
