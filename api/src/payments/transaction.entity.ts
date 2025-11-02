import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../common/common.pure.entity';

export enum TransactionStatus {
    PENDING = 'PENDING',
    RECONCILED = 'RECONCILED',
    UNMATCHED = 'UNMATCHED',
    FAILED = 'FAILED',
}

@Entity({ name: 'transactions' })
export class TransactionEntity extends AbstractBaseEntity {
    @Column({ nullable: true })
    provider: string;

    @Column({ nullable: true })
    providerReference: string;

    @Column({ nullable: true })
    virtualAccountId: string;

    @Column({ nullable: true })
    userId: number;

    @Column({ type: 'double precision', nullable: false })
    amount: number;

    @Column({ nullable: true })
    currency: string;

    @Column({ type: 'text', nullable: true })
    rawPayload: string;

    @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
    status: TransactionStatus;

    @Column({ type: 'timestamp', nullable: true })
    reconciledAt: Date;
}

export default TransactionEntity;
