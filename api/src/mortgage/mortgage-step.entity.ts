import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from 'src/common/common.entity';
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

    // Self-referencing pointer to the next step to mimic a linked list when desired
    @OneToOne(() => MortgageStep, { nullable: true })
    @JoinColumn({ name: 'next_step_id' })
    nextStep: MortgageStep;

    @Column({ nullable: true })
    nextStepId: number;

    @Column({ default: false })
    isOptional: boolean;

    @Column({ nullable: true })
    completedAt: Date;
}

export default MortgageStep;
