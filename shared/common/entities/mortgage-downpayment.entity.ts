import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { Mortgage } from './mortgage.entity';
import { MortgageDownpaymentInstallment } from './mortgage-downpayment-installment.entity';
import { Frequency } from '../types/common.type';

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

    @Column({ name: 'mortgage_id', nullable: true })
    mortgageId: number;

    @Column({ name: 'total_amount', type: 'double precision' })
    totalAmount: number;

    @Column({ name: 'installment_count', type: 'int', nullable: true })
    installmentCount: number;

    @Column({ name: 'frequency', nullable: true, type: 'enum', enum: Frequency })
    frequency: Frequency;

    @Column({ name: 'start_date', type: 'date', nullable: true })
    startDate: Date;

    @Column({ name: 'status', type: 'enum', enum: DownpaymentPlanStatus, default: DownpaymentPlanStatus.PENDING })
    status: DownpaymentPlanStatus;

    @OneToMany(() => MortgageDownpaymentInstallment, (i) => i.plan, { cascade: true })
    installments: MortgageDownpaymentInstallment[];
}

export default MortgageDownpaymentPlan;
