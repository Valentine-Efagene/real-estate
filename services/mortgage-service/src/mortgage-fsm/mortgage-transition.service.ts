import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MortgageTransition } from '@valentine-efagene/qshelter-common';
import { MortgageTransitionEvent } from '@valentine-efagene/qshelter-common';
import { MortgageAction, MortgageFSMContext } from './mortgage-fsm.types';

interface EventExecutionResult {
    eventId: number;
    action: MortgageAction;
    success: boolean;
    result?: any;
    error?: string;
    durationMs: number;
}

@Injectable()
export class MortgageTransitionService {
    private readonly logger = new Logger(MortgageTransitionService.name);

    constructor(
        @InjectRepository(MortgageTransition)
        private transitionRepo: Repository<MortgageTransition>,

        @InjectRepository(MortgageTransitionEvent)
        private eventRepo: Repository<MortgageTransitionEvent>,

        private dataSource: DataSource,
    ) { }

    /**
     * Create a new transition record with its associated events
     */
    async createTransition(
        transitionData: Partial<MortgageTransition>,
        actions: Array<{ action: MortgageAction; payload?: any; order?: number }>
    ): Promise<MortgageTransition> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Create the transition
            const transition = this.transitionRepo.create(transitionData);
            const savedTransition = await queryRunner.manager.save(transition);

            // Create associated events
            const events = actions.map((action, index) => {
                const idempotencyKey = `${savedTransition.id}-${action.action}-${action.order || index}`;

                return this.eventRepo.create({
                    transitionId: savedTransition.id,
                    action: action.action,
                    executionOrder: action.order !== undefined ? action.order : index,
                    payload: action.payload,
                    status: 'pending',
                    idempotencyKey,
                });
            });

            await queryRunner.manager.save(events);

            await queryRunner.commitTransaction();

            this.logger.log(
                `Created transition ${savedTransition.id} with ${events.length} events`,
                { mortgageId: savedTransition.mortgageId }
            );

            return savedTransition;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Failed to create transition', error.stack);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Execute all events for a transition in order
     */
    async executeTransitionEvents(
        transitionId: number,
        context: MortgageFSMContext,
        actionExecutors: Map<MortgageAction, (ctx: MortgageFSMContext, payload?: any) => Promise<any>>
    ): Promise<EventExecutionResult[]> {
        const events = await this.eventRepo.find({
            where: { transitionId },
            order: { executionOrder: 'ASC' },
        });

        const results: EventExecutionResult[] = [];
        const executedEvents: MortgageTransitionEvent[] = [];

        try {
            for (const event of events) {
                const result = await this.executeEvent(event, context, actionExecutors);
                results.push(result);
                executedEvents.push(event);

                if (!result.success) {
                    // Rollback all previously executed events
                    this.logger.warn(
                        `Event ${event.id} failed, rolling back ${executedEvents.length - 1} events`,
                        { transitionId, action: event.action }
                    );
                    await this.rollbackEvents(executedEvents.slice(0, -1), context, actionExecutors);
                    throw new Error(`Event execution failed: ${result.error}`);
                }
            }

            return results;
        } catch (error) {
            this.logger.error('Transition event execution failed', error.stack);
            throw error;
        }
    }

    /**
     * Execute a single event
     */
    private async executeEvent(
        event: MortgageTransitionEvent,
        context: MortgageFSMContext,
        actionExecutors: Map<MortgageAction, (ctx: MortgageFSMContext, payload?: any) => Promise<any>>
    ): Promise<EventExecutionResult> {
        const startTime = Date.now();

        try {
            // Update event status to executing
            await this.eventRepo.update(event.id, {
                status: 'executing',
                startedAt: new Date(),
            });

            const executor = actionExecutors.get(event.action);
            if (!executor) {
                throw new Error(`No executor found for action: ${event.action}`);
            }

            // Execute the action
            const result = await executor(context, event.payload);
            const durationMs = Date.now() - startTime;

            // Update event as completed
            await this.eventRepo.update(event.id, {
                status: 'completed',
                result,
                durationMs,
                completedAt: new Date(),
            });

            this.logger.debug(`Event ${event.id} completed successfully`, {
                action: event.action,
                durationMs,
            });

            return {
                eventId: event.id,
                action: event.action,
                success: true,
                result,
                durationMs,
            };
        } catch (error) {
            const durationMs = Date.now() - startTime;

            // Check if we should retry
            if (event.retryCount < event.maxRetries) {
                const nextRetryAt = new Date(Date.now() + Math.pow(2, event.retryCount) * 1000);
                await this.eventRepo.update(event.id, {
                    status: 'pending',
                    retryCount: event.retryCount + 1,
                    nextRetryAt,
                    error: error.message,
                    errorStack: error.stack,
                });

                this.logger.warn(
                    `Event ${event.id} failed, will retry (${event.retryCount + 1}/${event.maxRetries})`,
                    { action: event.action, nextRetryAt }
                );
            } else {
                await this.eventRepo.update(event.id, {
                    status: 'failed',
                    error: error.message,
                    errorStack: error.stack,
                    durationMs,
                    completedAt: new Date(),
                });
            }

            return {
                eventId: event.id,
                action: event.action,
                success: false,
                error: error.message,
                durationMs,
            };
        }
    }

    /**
     * Rollback events in reverse order
     */
    private async rollbackEvents(
        events: MortgageTransitionEvent[],
        context: MortgageFSMContext,
        actionExecutors: Map<MortgageAction, (ctx: MortgageFSMContext, payload?: any) => Promise<any>>
    ): Promise<void> {
        const reversedEvents = [...events].reverse();

        for (const event of reversedEvents) {
            try {
                const rollbackExecutor = actionExecutors.get(`ROLLBACK_${event.action}` as MortgageAction);

                if (rollbackExecutor) {
                    await rollbackExecutor(context, event.payload);
                    await this.eventRepo.update(event.id, {
                        rolledBack: true,
                        rolledBackAt: new Date(),
                    });
                    this.logger.debug(`Rolled back event ${event.id}`, { action: event.action });
                } else {
                    this.logger.warn(`No rollback executor for action: ${event.action}`);
                }
            } catch (error) {
                this.logger.error(`Failed to rollback event ${event.id}`, error.stack);
                await this.eventRepo.update(event.id, {
                    rollbackError: error.message,
                });
            }
        }
    }

    /**
     * Get all transitions for a mortgage
     */
    async getTransitionsForMortgage(
        mortgageId: number,
        options?: { includeEvents?: boolean; limit?: number }
    ): Promise<MortgageTransition[]> {
        const query = this.transitionRepo
            .createQueryBuilder('transition')
            .where('transition.mortgageId = :mortgageId', { mortgageId })
            .orderBy('transition.createdAt', 'DESC');

        if (options?.includeEvents) {
            query.leftJoinAndSelect('transition.events', 'event')
                .addOrderBy('event.executionOrder', 'ASC');
        }

        if (options?.limit) {
            query.take(options.limit);
        }

        return query.getMany();
    }

    /**
     * Get events for a specific transition
     */
    async getEventsForTransition(transitionId: number): Promise<MortgageTransitionEvent[]> {
        return this.eventRepo.find({
            where: { transitionId },
            order: { executionOrder: 'ASC' },
        });
    }

    /**
     * Get pending events that need retry
     */
    async getPendingRetryEvents(): Promise<MortgageTransitionEvent[]> {
        return this.eventRepo
            .createQueryBuilder('event')
            .where('event.status = :status', { status: 'pending' })
            .andWhere('event.retryCount > 0')
            .andWhere('event.nextRetryAt <= :now', { now: new Date() })
            .orderBy('event.nextRetryAt', 'ASC')
            .getMany();
    }

    /**
     * Retry a failed event
     */
    async retryEvent(
        eventId: number,
        context: MortgageFSMContext,
        actionExecutors: Map<MortgageAction, (ctx: MortgageFSMContext, payload?: any) => Promise<any>>
    ): Promise<EventExecutionResult> {
        const event = await this.eventRepo.findOne({ where: { id: eventId } });
        if (!event) {
            throw new Error(`Event ${eventId} not found`);
        }

        return this.executeEvent(event, context, actionExecutors);
    }

    /**
     * Get transition statistics
     */
    async getTransitionStats(mortgageId: number): Promise<{
        totalTransitions: number;
        successfulTransitions: number;
        failedTransitions: number;
        totalEvents: number;
        completedEvents: number;
        failedEvents: number;
        averageTransitionDuration: number;
    }> {
        const transitions = await this.transitionRepo.find({
            where: { mortgageId },
        });

        const events = await this.dataSource
            .createQueryBuilder()
            .select('event')
            .from(MortgageTransitionEvent, 'event')
            .innerJoin('event.transition', 'transition')
            .where('transition.mortgageId = :mortgageId', { mortgageId })
            .getMany();

        const successfulTransitions = transitions.filter(t => t.success).length;
        const failedTransitions = transitions.filter(t => !t.success).length;
        const completedEvents = events.filter(e => e.status === 'completed').length;
        const failedEvents = events.filter(e => e.status === 'failed').length;

        const durations = transitions
            .filter(t => t.durationMs)
            .map(t => t.durationMs);
        const averageTransitionDuration = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        return {
            totalTransitions: transitions.length,
            successfulTransitions,
            failedTransitions,
            totalEvents: events.length,
            completedEvents,
            failedEvents,
            averageTransitionDuration,
        };
    }
}

export default MortgageTransitionService;
