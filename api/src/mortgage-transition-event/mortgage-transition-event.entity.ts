import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { MortgageAction } from '../mortgage-fsm/mortgage-fsm.types';
import { MortgageTransition } from '../mortgage-transition/mortgage-transition.entity';

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

    @Column()
    @Index()
    transitionId: number;

    @Column({ type: 'varchar' })
    action: MortgageAction; // Type of action/side effect

    @Column({ type: 'int', default: 0 })
    executionOrder: number; // Order in which this event should execute

    @Column({ type: 'varchar', default: 'pending' })
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back';

    @Column({ type: 'json', nullable: true })
    payload: any; // Action-specific data

    @Column({ type: 'json', nullable: true })
    result: any; // Result of the action execution

    @Column({ type: 'text', nullable: true })
    error: string;

    @Column({ type: 'text', nullable: true })
    errorStack: string;

    // For idempotency - prevent duplicate execution
    @Column({ type: 'varchar', nullable: true, unique: true })
    idempotencyKey: string;

    // Retry configuration
    @Column({ type: 'int', default: 0 })
    retryCount: number;

    @Column({ type: 'int', default: 3 })
    maxRetries: number;

    @Column({ type: 'timestamp', nullable: true })
    nextRetryAt: Date;

    // Timing information
    @Column({ type: 'int', nullable: true })
    durationMs: number;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    startedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date;

    // Rollback information
    @Column({ default: false })
    rolledBack: boolean;

    @Column({ type: 'timestamp', nullable: true })
    rolledBackAt: Date;

    @Column({ type: 'text', nullable: true })
    rollbackError: string;
}

export default MortgageTransitionEvent;
