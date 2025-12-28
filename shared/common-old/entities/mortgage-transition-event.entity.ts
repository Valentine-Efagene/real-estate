import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { MortgageAction } from '../types/mortgage-fsm.type';
import { MortgageTransition } from './mortgage-transition.entity';

/**
 * Side effects/events triggered by transitions
 * Each transition can have multiple events that are executed
 */
@Entity({ name: 'mortgage_transition_events' })
@Index(['transitionId', 'executionOrder'])
@Index(['status', 'createdAt'])
export class MortgageTransitionEvent {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => MortgageTransition, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'transition_id' })
    transition: MortgageTransition;

    @Column({ name: 'transition_id' })
    @Index()
    transitionId: number;

    @Column({ type: 'varchar' })
    action: MortgageAction; // Type of action/side effect

    @Column({ type: 'int', default: 0, name: 'execution_order' })
    executionOrder: number; // Order in which this event should execute

    @Column({ type: 'varchar', default: 'pending' })
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back';

    @Column({ type: 'json', nullable: true })
    payload: any; // Action-specific data

    @Column({ type: 'json', nullable: true })
    result: any; // Result of the action execution

    @Column({ type: 'text', nullable: true })
    error: string;

    @Column({ type: 'text', nullable: true, name: 'error_stack' })
    errorStack: string;

    // For idempotency - prevent duplicate execution
    @Column({ type: 'varchar', nullable: true, unique: true, name: 'idempotency_key' })
    idempotencyKey: string;

    // Retry configuration
    @Column({ type: 'int', default: 0, name: 'retry_count' })
    retryCount: number;

    @Column({ type: 'int', default: 3, name: 'max_retries' })
    maxRetries: number;

    @Column({ type: 'timestamp', nullable: true, name: 'next_retry_at' })
    nextRetryAt: Date;

    // Timing information
    @Column({ type: 'int', nullable: true, name: 'duration_ms' })
    durationMs: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
    startedAt: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
    completedAt: Date;

    // Rollback information
    @Column({ default: false, name: 'rolled_back' })
    rolledBack: boolean;

    @Column({ type: 'timestamp', nullable: true, name: 'rolled_back_at' })
    rolledBackAt: Date;

    @Column({ type: 'text', nullable: true, name: 'rollback_error' })
    rollbackError: string;
}

export default MortgageTransitionEvent;
