import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Mortgage } from './mortgage.entity';

@Entity({ name: 'mortgage_step' })
export class MortgageStep extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Mortgage, (mortgage) => mortgage.steps, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'mortgage_id' })
    mortgage: Mortgage;

    @Column({ name: 'mortgage_id', nullable: true })
    mortgageId: number;

    @Column({ name: 'title' })
    title: string;

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string;

    // Sequence order - easier to query and reorder than relying purely on linked-list pointers
    @Column({ name: 'sequence', type: 'int', default: 0 })
    sequence: number;

    // We use `sequence` for ordering. Removed linked-list pointer fields (nextStep/nextStepId) to reduce redundancy.

    @Column({ name: 'is_optional', default: false })
    isOptional: boolean;

    @Column({ name: 'completed_at', nullable: true })
    completedAt: Date;
}

export default MortgageStep;
