import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
    MortgageState,
    MortgageEvent,
    MortgageFSMContext,
    StateTransition,
    TransitionGuard,
    TransitionAction,
    MortgageStateChangeEvent,
    MortgageAction,
} from './mortgage-fsm.types';
import { Mortgage } from '@valentine-efagene/qshelter-common';
import { MortgageTransition } from '@valentine-efagene/qshelter-common';
import { MortgageTransitionService } from './mortgage-transition.service';


@Injectable()
export class MortgageFSMService {
    private readonly logger = new Logger(MortgageFSMService.name);
    private transitions: StateTransition[] = [];
    private actionExecutors: Map<MortgageAction, (ctx: MortgageFSMContext, payload?: any) => Promise<any>>;

    constructor(
        @InjectRepository(Mortgage)
        private mortgageRepo: Repository<Mortgage>,

        // @InjectRepository(MortgageStateHistory)
        // private stateHistoryRepo: Repository<MortgageStateHistory>,

        private transitionService: MortgageTransitionService,

        private dataSource: DataSource,
    ) {
        this.initializeStateMachine();
        this.initializeActionExecutors();
    }

    /**
     * Initialize all valid state transitions with guards and actions
     */
    private initializeStateMachine(): void {
        this.transitions = [
            // ==================== APPLICATION PHASE ====================
            {
                from: MortgageState.DRAFT,
                to: MortgageState.SUBMITTED,
                event: MortgageEvent.SUBMIT_APPLICATION,
                description: 'Submit mortgage application',
                guards: [
                    {
                        name: 'hasRequiredFields',
                        check: (ctx) => !!(ctx.borrowerId && ctx.propertyId && ctx.principal),
                        errorMessage: 'Missing required fields (borrower, property, principal)',
                    },
                ],
                actions: [
                    { name: MortgageAction.NOTIFY_UNDERWRITER, execute: this.notifyUnderwriter.bind(this) },
                    { name: MortgageAction.LOG_AUDIT_TRAIL, execute: this.logAudit.bind(this) },
                ],
            },
            {
                from: MortgageState.SUBMITTED,
                to: MortgageState.DOCUMENT_COLLECTION,
                event: MortgageEvent.REQUEST_DOCUMENTS,
                description: 'Request required documents from borrower',
                actions: [
                    { name: MortgageAction.NOTIFY_BORROWER, execute: this.notifyBorrower.bind(this) },
                ],
            },
            {
                from: MortgageState.DOCUMENT_COLLECTION,
                to: MortgageState.UNDERWRITING,
                event: MortgageEvent.DOCUMENTS_SUBMITTED,
                description: 'All documents received, start underwriting',
                guards: [
                    {
                        name: 'documentsComplete',
                        check: (ctx) => ctx.documentsComplete === true,
                        errorMessage: 'Not all required documents submitted',
                    },
                ],
                actions: [
                    { name: MortgageAction.ASSIGN_UNDERWRITER, execute: this.assignUnderwriter.bind(this) },
                ],
            },

            // ==================== UNDERWRITING PHASE ====================
            {
                from: MortgageState.UNDERWRITING,
                to: MortgageState.APPRAISAL_ORDERED,
                event: MortgageEvent.ORDER_APPRAISAL,
                description: 'Order property appraisal',
                actions: [
                    { name: MortgageAction.SCHEDULE_INSPECTION, execute: this.scheduleInspection.bind(this) },
                    { name: MortgageAction.ORDER_TITLE_SEARCH, execute: this.orderTitleSearch.bind(this) },
                ],
            },
            {
                from: MortgageState.APPRAISAL_ORDERED,
                to: MortgageState.APPRAISAL_REVIEW,
                event: MortgageEvent.APPRAISAL_COMPLETED,
                description: 'Appraisal completed, under review',
            },
            {
                from: MortgageState.APPRAISAL_REVIEW,
                to: MortgageState.CONDITIONAL_APPROVAL,
                event: MortgageEvent.APPRAISAL_APPROVED,
                description: 'Appraisal approved, conditional approval granted',
                guards: [
                    {
                        name: 'appraisalMeetsLTV',
                        check: (ctx) => {
                            if (!ctx.appraisalValue) return false;
                            const ltv = (ctx.principal / ctx.appraisalValue) * 100;
                            return ltv <= 97; // Max 97% LTV for conventional
                        },
                        errorMessage: 'Loan-to-value ratio exceeds maximum',
                    },
                ],
                actions: [
                    { name: MortgageAction.GENERATE_APPROVAL_LETTER, execute: this.generateApprovalLetter.bind(this) },
                ],
            },
            {
                from: MortgageState.APPRAISAL_REVIEW,
                to: MortgageState.REJECTED,
                event: MortgageEvent.APPRAISAL_REJECTED,
                description: 'Appraisal rejected, application denied',
                actions: [
                    { name: MortgageAction.NOTIFY_BORROWER, execute: this.notifyBorrower.bind(this) },
                ],
            },

            // ==================== APPROVAL PHASE ====================
            {
                from: MortgageState.CONDITIONAL_APPROVAL,
                to: MortgageState.APPROVED,
                event: MortgageEvent.CONDITIONS_MET,
                description: 'All conditions met, fully approved',
                guards: [
                    {
                        name: 'allConditionsMet',
                        check: (ctx) => ctx.conditionsMet === true,
                        errorMessage: 'Not all conditions have been satisfied',
                    },
                ],
                actions: [
                    { name: MortgageAction.GENERATE_CLOSING_DISCLOSURE, execute: this.generateClosingDisclosure.bind(this) },
                    { name: MortgageAction.NOTIFY_CLOSER, execute: this.notifyCloser.bind(this) },
                ],
            },
            {
                from: MortgageState.APPROVED,
                to: MortgageState.CLOSING_SCHEDULED,
                event: MortgageEvent.SCHEDULE_CLOSING,
                description: 'Closing date scheduled',
            },

            // ==================== DOWNPAYMENT PHASE ====================
            {
                from: [MortgageState.APPROVED, MortgageState.CLOSING_SCHEDULED],
                to: MortgageState.AWAITING_DOWNPAYMENT,
                event: MortgageEvent.REQUEST_DOWNPAYMENT,
                description: 'Request down payment from borrower',
                actions: [
                    { name: MortgageAction.NOTIFY_BORROWER, execute: this.notifyBorrower.bind(this) },
                ],
            },
            {
                from: MortgageState.AWAITING_DOWNPAYMENT,
                to: MortgageState.DOWNPAYMENT_PARTIAL,
                event: MortgageEvent.RECEIVE_PARTIAL_DOWNPAYMENT,
                description: 'Partial down payment received',
                guards: [
                    {
                        name: 'partialPaymentValid',
                        check: (ctx) => {
                            const received = ctx.downPaymentReceived || 0;
                            return received > 0 && received < ctx.downPayment;
                        },
                        errorMessage: 'Invalid partial payment amount',
                    },
                ],
            },
            {
                from: [MortgageState.AWAITING_DOWNPAYMENT, MortgageState.DOWNPAYMENT_PARTIAL],
                to: MortgageState.DOWNPAYMENT_COMPLETE,
                event: MortgageEvent.RECEIVE_FULL_DOWNPAYMENT,
                description: 'Full down payment received',
                guards: [
                    {
                        name: 'fullPaymentReceived',
                        check: (ctx) => {
                            const received = ctx.downPaymentReceived || 0;
                            return received >= ctx.downPayment;
                        },
                        errorMessage: 'Full down payment not yet received',
                    },
                ],
                actions: [
                    { name: MortgageAction.CREATE_ESCROW_ACCOUNT, execute: this.createEscrow.bind(this) },
                ],
            },

            // ==================== ACTIVATION PHASE ====================
            {
                from: MortgageState.DOWNPAYMENT_COMPLETE,
                to: MortgageState.ACTIVE,
                event: MortgageEvent.DISBURSE_FUNDS,
                description: 'Disburse loan funds, activate mortgage',
                actions: [
                    { name: MortgageAction.DISBURSE_LOAN_AMOUNT, execute: this.disburseFunds.bind(this) },
                    { name: MortgageAction.CALCULATE_PAYMENT_SCHEDULE, execute: this.calculatePaymentSchedule.bind(this) },
                    { name: MortgageAction.RECORD_LIEN, execute: this.recordLien.bind(this) },
                    { name: MortgageAction.UPDATE_CREDIT_BUREAU, execute: this.updateCreditBureau.bind(this) },
                ],
            },

            // ==================== DELINQUENCY STATES ====================
            {
                from: MortgageState.ACTIVE,
                to: MortgageState.DELINQUENT_30,
                event: MortgageEvent.MARK_DELINQUENT,
                description: '30 days past due',
                guards: [
                    {
                        name: 'thirtyDaysPastDue',
                        check: (ctx) => (ctx.daysPastDue || 0) >= 30,
                    },
                ],
                actions: [
                    { name: MortgageAction.ASSESS_LATE_FEE, execute: this.assessLateFee.bind(this) },
                    { name: MortgageAction.NOTIFY_BORROWER, execute: this.notifyBorrower.bind(this) },
                ],
            },
            {
                from: MortgageState.DELINQUENT_30,
                to: MortgageState.DELINQUENT_60,
                event: MortgageEvent.MARK_DELINQUENT,
                description: '60 days past due',
                guards: [
                    {
                        name: 'sixtyDaysPastDue',
                        check: (ctx) => (ctx.daysPastDue || 0) >= 60,
                    },
                ],
                actions: [
                    { name: MortgageAction.UPDATE_CREDIT_BUREAU, execute: this.updateCreditBureau.bind(this) },
                    { name: MortgageAction.NOTIFY_COLLECTIONS, execute: this.notifyCollections.bind(this) },
                ],
            },
            {
                from: MortgageState.DELINQUENT_60,
                to: MortgageState.DELINQUENT_90,
                event: MortgageEvent.MARK_DELINQUENT,
                description: '90 days past due',
                guards: [
                    {
                        name: 'ninetyDaysPastDue',
                        check: (ctx) => (ctx.daysPastDue || 0) >= 90,
                    },
                ],
            },
            {
                from: MortgageState.DELINQUENT_90,
                to: MortgageState.DELINQUENT_120_PLUS,
                event: MortgageEvent.MARK_DELINQUENT,
                description: '120+ days past due',
                guards: [
                    {
                        name: 'oneTwentyPlusDaysPastDue',
                        check: (ctx) => (ctx.daysPastDue || 0) >= 120,
                    },
                ],
            },
            {
                from: [MortgageState.DELINQUENT_30, MortgageState.DELINQUENT_60, MortgageState.DELINQUENT_90, MortgageState.DELINQUENT_120_PLUS],
                to: MortgageState.ACTIVE,
                event: MortgageEvent.CURE_DELINQUENCY,
                description: 'Delinquency cured, return to current status',
                actions: [
                    { name: MortgageAction.UPDATE_CREDIT_BUREAU, execute: this.updateCreditBureau.bind(this) },
                ],
            },

            // ==================== DEFAULT & MITIGATION ====================
            {
                from: [MortgageState.DELINQUENT_90, MortgageState.DELINQUENT_120_PLUS],
                to: MortgageState.DEFAULT,
                event: MortgageEvent.DECLARE_DEFAULT,
                description: 'Declare mortgage in default',
                actions: [
                    { name: MortgageAction.NOTIFY_LEGAL, execute: this.notifyLegal.bind(this) },
                    { name: MortgageAction.UPDATE_CREDIT_BUREAU, execute: this.updateCreditBureau.bind(this) },
                ],
            },
            {
                from: [MortgageState.DEFAULT, MortgageState.DELINQUENT_90],
                to: MortgageState.FORBEARANCE,
                event: MortgageEvent.GRANT_FORBEARANCE,
                description: 'Grant payment forbearance',
            },
            {
                from: [MortgageState.DEFAULT, MortgageState.FORBEARANCE],
                to: MortgageState.MODIFICATION,
                event: MortgageEvent.APPROVE_MODIFICATION,
                description: 'Approve loan modification',
            },
            {
                from: MortgageState.DEFAULT,
                to: MortgageState.SHORT_SALE,
                event: MortgageEvent.APPROVE_SHORT_SALE,
                description: 'Approve short sale',
            },

            // ==================== FORECLOSURE ====================
            {
                from: [MortgageState.DEFAULT, MortgageState.DELINQUENT_120_PLUS],
                to: MortgageState.FORECLOSURE_INITIATED,
                event: MortgageEvent.INITIATE_FORECLOSURE,
                description: 'Initiate foreclosure proceedings',
                actions: [
                    { name: MortgageAction.NOTIFY_LEGAL, execute: this.notifyLegal.bind(this) },
                    { name: MortgageAction.NOTIFY_BORROWER, execute: this.notifyBorrower.bind(this) },
                ],
            },
            {
                from: MortgageState.FORECLOSURE_INITIATED,
                to: MortgageState.FORECLOSURE_PENDING,
                event: MortgageEvent.FORECLOSE,
                description: 'Foreclosure in progress',
            },
            {
                from: MortgageState.FORECLOSURE_PENDING,
                to: MortgageState.FORECLOSED,
                event: MortgageEvent.FORECLOSE,
                description: 'Foreclosure completed',
            },
            {
                from: MortgageState.FORECLOSED,
                to: MortgageState.REO,
                event: MortgageEvent.CONVERT_TO_REO,
                description: 'Convert to REO (Real Estate Owned)',
            },

            // ==================== COMPLETION ====================
            {
                from: MortgageState.ACTIVE,
                to: MortgageState.PAID_OFF,
                event: MortgageEvent.PAY_OFF,
                description: 'Mortgage paid off in full',
                guards: [
                    {
                        name: 'balancePaidInFull',
                        check: (ctx) => (ctx.remainingBalance || 0) <= 0,
                        errorMessage: 'Balance not yet paid in full',
                    },
                ],
                actions: [
                    { name: MortgageAction.RELEASE_LIEN, execute: this.releaseLien.bind(this) },
                    { name: MortgageAction.UPDATE_CREDIT_BUREAU, execute: this.updateCreditBureau.bind(this) },
                    { name: MortgageAction.NOTIFY_BORROWER, execute: this.notifyBorrower.bind(this) },
                ],
            },
            {
                from: MortgageState.ACTIVE,
                to: MortgageState.REFINANCED,
                event: MortgageEvent.REFINANCE,
                description: 'Mortgage refinanced',
                actions: [
                    { name: MortgageAction.RELEASE_LIEN, execute: this.releaseLien.bind(this) },
                ],
            },

            // ==================== TERMINATION ====================
            {
                from: [MortgageState.DRAFT, MortgageState.SUBMITTED, MortgageState.DOCUMENT_COLLECTION],
                to: MortgageState.WITHDRAWN,
                event: MortgageEvent.WITHDRAW,
                description: 'Application withdrawn by borrower',
            },
            {
                from: [MortgageState.UNDERWRITING, MortgageState.APPRAISAL_REVIEW, MortgageState.CONDITIONAL_APPROVAL],
                to: MortgageState.REJECTED,
                event: MortgageEvent.REJECT,
                description: 'Application rejected',
                actions: [
                    { name: MortgageAction.NOTIFY_BORROWER, execute: this.notifyBorrower.bind(this) },
                ],
            },
            {
                from: [MortgageState.DRAFT, MortgageState.SUBMITTED, MortgageState.APPROVED],
                to: MortgageState.CANCELLED,
                event: MortgageEvent.CANCEL,
                description: 'Application cancelled',
            },
        ];

        this.logger.log(`Initialized FSM with ${this.transitions.length} state transitions`);
    }

    /**
     * Initialize action executors map
     */
    private initializeActionExecutors(): void {
        this.actionExecutors = new Map();

        // Map all actions to their executor methods
        this.actionExecutors.set(MortgageAction.NOTIFY_BORROWER, this.notifyBorrower.bind(this));
        this.actionExecutors.set(MortgageAction.NOTIFY_UNDERWRITER, this.notifyUnderwriter.bind(this));
        this.actionExecutors.set(MortgageAction.NOTIFY_CLOSER, this.notifyCloser.bind(this));
        this.actionExecutors.set(MortgageAction.NOTIFY_COLLECTIONS, this.notifyCollections.bind(this));
        this.actionExecutors.set(MortgageAction.NOTIFY_LEGAL, this.notifyLegal.bind(this));
        this.actionExecutors.set(MortgageAction.LOG_AUDIT_TRAIL, this.logAudit.bind(this));
        this.actionExecutors.set(MortgageAction.ASSIGN_UNDERWRITER, this.assignUnderwriter.bind(this));
        this.actionExecutors.set(MortgageAction.SCHEDULE_INSPECTION, this.scheduleInspection.bind(this));
        this.actionExecutors.set(MortgageAction.ORDER_TITLE_SEARCH, this.orderTitleSearch.bind(this));
        this.actionExecutors.set(MortgageAction.GENERATE_APPROVAL_LETTER, this.generateApprovalLetter.bind(this));
        this.actionExecutors.set(MortgageAction.GENERATE_CLOSING_DISCLOSURE, this.generateClosingDisclosure.bind(this));
        this.actionExecutors.set(MortgageAction.CREATE_ESCROW_ACCOUNT, this.createEscrow.bind(this));
        this.actionExecutors.set(MortgageAction.DISBURSE_LOAN_AMOUNT, this.disburseFunds.bind(this));
        this.actionExecutors.set(MortgageAction.CALCULATE_PAYMENT_SCHEDULE, this.calculatePaymentSchedule.bind(this));
        this.actionExecutors.set(MortgageAction.RECORD_LIEN, this.recordLien.bind(this));
        this.actionExecutors.set(MortgageAction.RELEASE_LIEN, this.releaseLien.bind(this));
        this.actionExecutors.set(MortgageAction.UPDATE_CREDIT_BUREAU, this.updateCreditBureau.bind(this));
        this.actionExecutors.set(MortgageAction.ASSESS_LATE_FEE, this.assessLateFee.bind(this));

        this.logger.log(`Initialized ${this.actionExecutors.size} action executors`);
    }

    /**
     * Execute a state transition
     */
    async transition(
        mortgageId: number,
        event: MortgageEvent,
        context: Partial<MortgageFSMContext>,
        triggeredBy: string = 'system'
    ): Promise<{ success: boolean; newState?: MortgageState; error?: string; transitionId?: number }> {
        const startTime = Date.now();
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let transitionRecord: MortgageTransition | null = null;

        try {
            // Load current mortgage state
            const mortgage = await queryRunner.manager.findOne(Mortgage, {
                where: { id: mortgageId },
                lock: { mode: 'pessimistic_write' },
            });

            if (!mortgage) {
                throw new BadRequestException('Mortgage not found');
            }

            const currentState = mortgage.state as MortgageState;

            // Build full context
            const fullContext: MortgageFSMContext = {
                mortgageId: mortgage.id,
                borrowerId: mortgage.borrowerId,
                propertyId: mortgage.propertyId,
                principal: mortgage.principal,
                downPayment: mortgage.downPayment,
                interestRate: mortgage.interestRate,
                termMonths: mortgage.termMonths,
                ...context,
                triggeredBy,
            };

            // Find matching transition
            const transitionDef = this.findTransition(currentState, event);
            if (!transitionDef) {
                throw new BadRequestException(
                    `Invalid transition: ${currentState} + ${event}`
                );
            }

            // Execute guards
            const guardsResult = await this.executeGuardsWithTracking(transitionDef, fullContext);

            // Create transition record with events
            const actions = (transitionDef.actions || []).map((action, index) => ({
                action: action.name as MortgageAction,
                payload: fullContext,
                order: index,
            }));

            transitionRecord = await this.transitionService.createTransition({
                mortgageId,
                fromState: currentState,
                toState: transitionDef.to,
                event,
                context: fullContext,
                triggeredBy,
                triggeredByType: triggeredBy.startsWith('user') ? 'user' : 'system',
                guardsChecked: guardsResult,
                success: false, // Will update on success
            }, actions);

            // Execute transition events (side effects)
            if (actions.length > 0) {
                await this.transitionService.executeTransitionEvents(
                    transitionRecord.id,
                    fullContext,
                    this.actionExecutors
                );
            }

            // Update mortgage state
            mortgage.state = transitionDef.to;
            mortgage.stateMetadata = JSON.stringify({
                lastTransition: {
                    from: currentState,
                    to: transitionDef.to,
                    event,
                    timestamp: new Date(),
                    triggeredBy,
                    transitionId: transitionRecord.id,
                },
            });
            await queryRunner.manager.save(mortgage);

            // Update transition record as successful
            const durationMs = Date.now() - startTime;
            await queryRunner.manager.update(MortgageTransition, transitionRecord.id, {
                success: true,
                durationMs,
                completedAt: new Date(),
            });

            // TODO: Publish state change event to event bus instead
            // Record state history (legacy - for backward compatibility)
            // const historyEntry = this.stateHistoryRepo.create({
            //     mortgageId,
            //     fromState: currentState,
            //     toState: transitionDef.to,
            //     event,
            //     context: fullContext,
            //     triggeredBy,
            //     success: true,
            // });
            // await queryRunner.manager.save(historyEntry);

            await queryRunner.commitTransaction();

            this.logger.log(
                `Transition successful: ${currentState} -> ${transitionDef.to} (${event})`,
                { mortgageId, triggeredBy, durationMs, transitionId: transitionRecord.id }
            );

            return {
                success: true,
                newState: transitionDef.to,
                transitionId: transitionRecord.id
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            const durationMs = Date.now() - startTime;

            this.logger.error(`Transition failed: ${event}`, error.stack, {
                mortgageId,
                triggeredBy,
            });

            // Update transition record as failed
            if (transitionRecord) {
                try {
                    await this.dataSource.manager.update(MortgageTransition, transitionRecord.id, {
                        success: false,
                        error: error.message,
                        errorStack: error.stack,
                        durationMs,
                        completedAt: new Date(),
                    });
                } catch (updateError) {
                    this.logger.error('Failed to update transition record', updateError);
                }
            }

            // TODO: Publish error event to event bus instead
            // Record failed transition in history (legacy)
            // try {
            //     const mortgage = await this.mortgageRepo.findOne({ where: { id: mortgageId } });
            //     if (mortgage) {
            //         await this.stateHistoryRepo.save({
            //             mortgageId,
            //             fromState: mortgage.state as MortgageState,
            //             toState: mortgage.state as MortgageState,
            //             event,
            //             context: context as any,
            //             triggeredBy,
            //             success: false,
            //             error: error.message,
            //         });
            //     }
            // } catch (historyError) {
            //     this.logger.error('Failed to record error in history', historyError);
            // }

            return { success: false, error: error.message };
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Execute guards and track results
     */
    private async executeGuardsWithTracking(
        transition: StateTransition,
        context: MortgageFSMContext
    ): Promise<Array<{ name: string; passed: boolean; message?: string }>> {
        if (!transition.guards) return [];

        const results: Array<{ name: string; passed: boolean; message?: string }> = [];

        for (const guard of transition.guards) {
            try {
                const result = await guard.check(context);
                results.push({
                    name: guard.name,
                    passed: result,
                    message: result ? undefined : guard.errorMessage,
                });

                if (!result) {
                    throw new BadRequestException(
                        guard.errorMessage || `Guard ${guard.name} failed`
                    );
                }
            } catch (error) {
                results.push({
                    name: guard.name,
                    passed: false,
                    message: error.message,
                });
                throw error;
            }
        }

        return results;
    }
    /**
     * Find matching transition
     */
    private findTransition(currentState: MortgageState, event: MortgageEvent): StateTransition | null {
        return this.transitions.find((t) => {
            const fromStates = Array.isArray(t.from) ? t.from : [t.from];
            return fromStates.includes(currentState) && t.event === event;
        }) || null;
    }

    /**
     * Execute guard conditions
     */
    private async executeGuards(transition: StateTransition, context: MortgageFSMContext): Promise<void> {
        if (!transition.guards) return;

        for (const guard of transition.guards) {
            const result = await guard.check(context);
            if (!result) {
                throw new BadRequestException(
                    guard.errorMessage || `Guard ${guard.name} failed`
                );
            }
        }
    }

    /**
     * Execute transition actions
     */
    private async executeActions(
        transition: StateTransition,
        context: MortgageFSMContext,
        queryRunner: any
    ): Promise<void> {
        if (!transition.actions) return;

        for (const action of transition.actions) {
            try {
                await action.execute(context);
            } catch (error) {
                this.logger.error(`Action ${action.name} failed`, error.stack);
                // Optionally execute rollback
                if (action.rollback) {
                    await action.rollback(context);
                }
                throw error;
            }
        }
    }

    /**
     * Get transition history for a mortgage
     * TODO: This should query from a separate history service via event bus
     */
    async getHistory(mortgageId: number): Promise<any[]> {
        // return this.stateHistoryRepo.find({
        //     where: { mortgageId },
        //     order: { timestamp: 'DESC' },
        // });
        this.logger.warn('getHistory called but history tracking is disabled. Use event bus history service.');
        return [];
    }

    /**
     * Get possible transitions from current state
     */
    getPossibleTransitions(currentState: MortgageState): Array<{ event: MortgageEvent; to: MortgageState; description?: string }> {
        return this.transitions
            .filter((t) => {
                const fromStates = Array.isArray(t.from) ? t.from : [t.from];
                return fromStates.includes(currentState);
            })
            .map((t) => ({
                event: t.event,
                to: t.to,
                description: t.description,
            }));
    }

    // ==================== ACTION IMPLEMENTATIONS ====================
    // These are placeholder implementations - customize based on your business logic

    private async notifyBorrower(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Notifying borrower', { mortgageId: context.mortgageId });
        // TODO: Implement actual notification (email, SMS, etc.)
    }

    private async notifyUnderwriter(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Notifying underwriter', { mortgageId: context.mortgageId });
        // TODO: Assign to underwriter queue
    }

    private async notifyCloser(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Notifying closer', { mortgageId: context.mortgageId });
    }

    private async notifyCollections(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Notifying collections', { mortgageId: context.mortgageId });
    }

    private async notifyLegal(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Notifying legal department', { mortgageId: context.mortgageId });
    }

    private async logAudit(context: MortgageFSMContext): Promise<void> {
        this.logger.log('Audit trail logged', { mortgageId: context.mortgageId });
    }

    private async assignUnderwriter(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Assigning underwriter', { mortgageId: context.mortgageId });
    }

    private async scheduleInspection(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Scheduling inspection', { mortgageId: context.mortgageId });
    }

    private async orderTitleSearch(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Ordering title search', { mortgageId: context.mortgageId });
    }

    private async generateApprovalLetter(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Generating approval letter', { mortgageId: context.mortgageId });
    }

    private async generateClosingDisclosure(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Generating closing disclosure', { mortgageId: context.mortgageId });
    }

    private async createEscrow(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Creating escrow account', { mortgageId: context.mortgageId });
    }

    private async disburseFunds(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Disbursing loan funds', {
            mortgageId: context.mortgageId,
            amount: context.principal,
        });
        // TODO: Integrate with payment processor
    }

    private async calculatePaymentSchedule(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Calculating payment schedule', { mortgageId: context.mortgageId });
        // TODO: Generate amortization schedule
    }

    private async recordLien(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Recording lien', { mortgageId: context.mortgageId });
    }

    private async releaseLien(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Releasing lien', { mortgageId: context.mortgageId });
    }

    private async updateCreditBureau(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Updating credit bureau', { mortgageId: context.mortgageId });
        // TODO: Report to credit bureaus
    }

    private async assessLateFee(context: MortgageFSMContext): Promise<void> {
        this.logger.debug('Assessing late fee', { mortgageId: context.mortgageId });
    }
}

export default MortgageFSMService;
