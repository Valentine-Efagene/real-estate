import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { MortgageState, MortgageEvent } from '../mortgage-fsm/mortgage-fsm.types';
import { Mortgage } from '../mortgage/mortgage.entity';

/**
 * Represents a single state transition in the mortgage FSM
 * Each transition can have multiple side effects (events)
 */
@Entity({ name: 'mortgage_transitions' })
@Index(['fromState', 'event'])
@Index(['mortgageId', 'createdAt'])
export class MortgageTransition {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Mortgage)
    @JoinColumn({ name: 'mortgage_id' })
    mortgage: Mortgage;

    @Column()
    @Index()
    mortgageId: number;

    @Column({ type: 'varchar' })
    fromState: MortgageState;

    @Column({ type: 'varchar' })
    toState: MortgageState;

    @Column({ type: 'varchar' })
    event: MortgageEvent;

    @Column({ type: 'json', nullable: true })
    context: any; // MortgageFSMContext

    @Column({ type: 'varchar' })
    triggeredBy: string; // User ID or system identifier

    @Column({ type: 'varchar', nullable: true })
    triggeredByType: string; // 'user', 'system', 'scheduler', etc.

    @Column({ default: true })
    success: boolean;

    @Column({ type: 'text', nullable: true })
    error: string;

    @Column({ type: 'text', nullable: true })
    errorStack: string;

    // Guard conditions that were checked
    @Column({ type: 'json', nullable: true })
    guardsChecked: Array<{ name: string; passed: boolean; message?: string }>;

    // Duration of the transition in milliseconds
    @Column({ type: 'int', nullable: true })
    durationMs: number;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date;
}

export default MortgageTransition;
