import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { MortgageDownpaymentPlan } from './mortgage-downpayment.entity';

export enum MortgageInstallmentStatus {
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

    @Column({ name: 'plan_id', nullable: true })
    planId: number;

    @Column({ name: 'sequence', type: 'int' })
    sequence: number;

    @Column({ name: 'due_date', type: 'date' })
    dueDate: Date;

    @Column({ name: 'amount_due', type: 'double precision' })
    amountDue: number;

    @Column({ name: 'amount_paid', type: 'double precision', default: 0 })
    amountPaid: number;

    @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
    paidAt: Date;

    @Column({ name: 'status', type: 'enum', enum: MortgageInstallmentStatus, default: MortgageInstallmentStatus.PENDING })
    status: MortgageInstallmentStatus;
}

export default MortgageDownpaymentInstallment;
