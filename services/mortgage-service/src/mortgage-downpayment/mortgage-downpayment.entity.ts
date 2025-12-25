import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractBaseEntity, Frequency, Mortgage, MortgageDownpaymentInstallment } from '@valentine-efagene/qshelter-common';

export enum DownpaymentPlanStatus {
    PENDING = 'PENDING',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    DEFAULTED = 'DEFAULTED',
    CANCELLED = 'CANCELLED',
}

@Entity({ name: 'mortgage_downpayment_plan' })
export class MortgageDownpaymentPlan extends AbstractBaseEntity {
    @ManyToOne(() => Mortgage, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'mortgage_id' })
    mortgage: Mortgage;

    @Column({ nullable: true })
    mortgageId: number;

    @Column({ type: 'double precision' })
    totalAmount: number;

    @Column({ type: 'int', nullable: true })
    installmentCount: number;

    @Column({ nullable: true, type: 'enum', enum: Frequency })
    frequency: Frequency;

    @Column({ type: 'date', nullable: true })
    startDate: Date;

    @Column({ type: 'enum', enum: DownpaymentPlanStatus, default: DownpaymentPlanStatus.PENDING })
    status: DownpaymentPlanStatus;

    @OneToMany(() => MortgageDownpaymentInstallment, (i) => i.plan, { cascade: true })
    installments: MortgageDownpaymentInstallment[];
}

export default MortgageDownpaymentPlan;
