import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from '@valentine-efagene/qshelter-common';
import { Mortgage } from './mortgage.entity';

@Entity({ name: 'mortgage_step' })
export class MortgageStep extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Mortgage, (mortgage) => mortgage.steps, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'mortgage_id' })
    mortgage: Mortgage;

    @Column({ nullable: true })
    mortgageId: number;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    // Sequence order - easier to query and reorder than relying purely on linked-list pointers
    @Column({ type: 'int', default: 0 })
    sequence: number;

    // We use `sequence` for ordering. Removed linked-list pointer fields (nextStep/nextStepId) to reduce redundancy.

    @Column({ default: false })
    isOptional: boolean;

    @Column({ nullable: true })
    completedAt: Date;
}

export default MortgageStep;
