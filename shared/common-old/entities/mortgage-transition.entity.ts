import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { MortgageState, MortgageEvent } from '../types/mortgage-fsm.type';
import { Mortgage } from './mortgage.entity';

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

    @Column({ name: 'mortgage_id' })
    @Index()
    mortgageId: number;

    @Column({ type: 'varchar', name: 'from_state' })
    fromState: MortgageState;

    @Column({ type: 'varchar', name: 'to_state' })
    toState: MortgageState;

    @Column({ type: 'varchar' })
    event: MortgageEvent;

    @Column({ type: 'json', nullable: true })
    context: any; // MortgageFSMContext

    @Column({ type: 'varchar', name: 'triggered_by' })
    triggeredBy: string; // User ID or system identifier

    @Column({ type: 'varchar', nullable: true, name: 'triggered_by_type' })
    triggeredByType: string; // 'user', 'system', 'scheduler', etc.

    @Column({ default: true })
    success: boolean;

    @Column({ type: 'text', nullable: true })
    error: string;

    @Column({ type: 'text', nullable: true, name: 'error_stack' })
    errorStack: string;

    // Guard conditions that were checked
    @Column({ type: 'json', nullable: true, name: 'guards_checked' })
    guardsChecked: Array<{ name: string; passed: boolean; message?: string }>;

    // Duration of the transition in milliseconds
    @Column({ type: 'int', nullable: true, name: 'duration_ms' })
    durationMs: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
    completedAt: Date;
}

export default MortgageTransition;
