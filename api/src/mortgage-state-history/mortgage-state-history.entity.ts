import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { MortgageState, MortgageEvent } from '../mortgage-fsm/mortgage-fsm.types';

/**
 * Entity to store state transition history (Event Sourcing)
 * @deprecated Use MortgageTransition instead
 */
@Entity({ name: 'mortgage_state_history' })
@Index(['mortgageId', 'timestamp'])
export class MortgageStateHistory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    @Index()
    mortgageId: number;

    @Column({ type: 'varchar' })
    fromState: MortgageState;

    @Column({ type: 'varchar' })
    toState: MortgageState;

    @Column({ type: 'varchar' })
    event: MortgageEvent;

    @Column({ type: 'json' })
    context: any;

    @Column()
    triggeredBy: string;

    @Column({ default: true })
    success: boolean;

    @Column({ type: 'text', nullable: true })
    error: string;

    @CreateDateColumn()
    timestamp: Date;
}

export default MortgageStateHistory;
