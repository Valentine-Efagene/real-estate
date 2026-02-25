import { prisma } from '../lib/prisma';
import { Prisma, PhaseStatus, StageStatus, PaymentEventPublisher } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import { approvalWorkflowService, type ApprovalStageSnapshot } from './approval-workflow.service';
import { createConditionEvaluatorService } from './condition-evaluator.service';

/**
 * Phase Orchestrator Service
 * 
 * Centralized service for managing phase lifecycle transitions.
 * This is the SINGLE source of truth for:
 * - Completing a phase
 * - Activating the next phase
 * - Completing the application when all phases are done
 * 
 * All code paths that complete a phase should call this service
 * rather than duplicating activation logic.
 */
class PhaseOrchestratorService {
    /**
     * Complete a phase and activate the next one.
     * This is the ONLY method that should be used to complete phases.
     * 
     * @param phaseId - The ID of the phase to complete
     * @param userId - The user who triggered the completion (for audit)
     * @param options - Additional options
     */
    async completePhaseAndActivateNext(
        phaseId: string,
        userId: string,
        options?: {
            skipNextActivation?: boolean;
            tx?: any; // Prisma transaction client
        }
    ): Promise<{
        completedPhase: any;
        nextPhase: any | null;
        applicationCompleted: boolean;
    }> {
        const db = options?.tx || prisma;

        // Get the phase with application context
        const phase = await db.applicationPhase.findUnique({
            where: { id: phaseId },
            include: {
                application: {
                    select: {
                        id: true,
                        tenantId: true,
                        propertyUnitId: true,
                        buyerId: true,
                        propertyUnit: { select: { variantId: true } },
                    },
                },
                documentationPhase: true,
            },
        });

        if (!phase) {
            throw new Error(`Phase not found: ${phaseId}`);
        }

        // If already completed (e.g. payment service marked it directly),
        // still advance to the next phase — that's why the event was sent.
        const alreadyCompleted = phase.status === PhaseStatus.COMPLETED;
        if (alreadyCompleted) {
            console.log('[PhaseOrchestrator] Phase already completed, advancing to next phase', { phaseId });
        }

        const tenantId = phase.application?.tenantId || phase.tenantId;
        const applicationId = phase.applicationId;

        // Use transaction if not already in one
        const executeInTransaction = async (tx: Prisma.TransactionClient) => {
            let completedPhase = phase;

            // 1. Mark phase as completed (skip if already done)
            if (!alreadyCompleted) {
                completedPhase = await tx.applicationPhase.update({
                    where: { id: phaseId },
                    data: {
                        status: PhaseStatus.COMPLETED,
                        completedAt: new Date(),
                    },
                });

                // 2. Clear documentation phase stage order if applicable
                if (phase.documentationPhase) {
                    await tx.documentationPhase.update({
                        where: { id: phase.documentationPhase.id },
                        data: { currentStageOrder: undefined },
                    });
                }

                // 3. Write PHASE.COMPLETED domain event
                await tx.domainEvent.create({
                    data: {
                        id: uuidv4(),
                        tenantId,
                        eventType: 'PHASE.COMPLETED',
                        aggregateType: 'ApplicationPhase',
                        aggregateId: phaseId,
                        queueName: 'application-steps',
                        payload: JSON.stringify({
                            phaseId,
                            applicationId,
                            phaseCategory: phase.phaseCategory,
                            phaseType: phase.phaseType,
                        }),
                        actorId: userId,
                    },
                });
            }

            // 4. Find and activate next phase (unless skipped)
            let nextPhase = null;
            let applicationCompleted = false;

            if (!options?.skipNextActivation) {
                nextPhase = await tx.applicationPhase.findFirst({
                    where: {
                        applicationId,
                        order: phase.order + 1,
                    },
                    include: {
                        documentationPhase: {
                            include: {
                                documentationPlan: {
                                    include: { approvalStages: { orderBy: { order: 'asc' } } },
                                },
                            },
                        },
                        paymentPhase: true,
                    },
                });

                if (nextPhase) {
                    // Activate next phase
                    await tx.applicationPhase.update({
                        where: { id: nextPhase.id },
                        data: {
                            status: PhaseStatus.IN_PROGRESS,
                            activatedAt: new Date(),
                        },
                    });

                    // Update application's current phase
                    await tx.application.update({
                        where: { id: applicationId },
                        data: { currentPhaseId: nextPhase.id },
                    });

                    // Initialize approval stages for DOCUMENTATION phases
                    if (nextPhase.documentationPhase) {
                        const approvalStages = (nextPhase.documentationPhase.approvalStagesSnapshot as unknown as ApprovalStageSnapshot[]) ||
                            nextPhase.documentationPhase.documentationPlan?.approvalStages || [];

                        if (approvalStages.length > 0) {
                            await approvalWorkflowService.initializeStageProgress(
                                tx,
                                nextPhase.documentationPhase.id,
                                tenantId,
                                approvalStages
                            );
                        }

                        // Set current stage to 1
                        await tx.documentationPhase.update({
                            where: { id: nextPhase.documentationPhase.id },
                            data: { currentStageOrder: 1 },
                        });

                        // Run condition evaluation if this phase references a questionnaire
                        if (nextPhase.documentationPhase.sourceQuestionnairePhaseId) {
                            const conditionEvaluator = createConditionEvaluatorService(tx);
                            await conditionEvaluator.applyConditionEvaluation(
                                nextPhase.documentationPhase.id
                            );
                        }
                    }

                    // Write PHASE.ACTIVATED domain event
                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            tenantId,
                            eventType: 'PHASE.ACTIVATED',
                            aggregateType: 'ApplicationPhase',
                            aggregateId: nextPhase.id,
                            queueName: 'application-steps',
                            payload: JSON.stringify({
                                phaseId: nextPhase.id,
                                applicationId,
                                phaseCategory: nextPhase.phaseCategory,
                                phaseType: nextPhase.phaseType,
                                previousPhaseId: phaseId,
                            }),
                            actorId: userId,
                        },
                    });

                    console.log('[PhaseOrchestrator] Activated next phase', {
                        completedPhaseId: phaseId,
                        nextPhaseId: nextPhase.id,
                        nextPhaseName: nextPhase.name,
                        nextPhaseCategory: nextPhase.phaseCategory,
                    });
                } else {
                    // No more phases - complete the application
                    applicationCompleted = true;

                    await tx.application.update({
                        where: { id: applicationId },
                        data: {
                            status: 'COMPLETED',
                            endDate: new Date(),
                            currentPhaseId: null,
                        },
                    });

                    // Mark property unit as SOLD and transfer ownership
                    if (phase.application?.propertyUnitId) {
                        await tx.propertyUnit.update({
                            where: { id: phase.application.propertyUnitId },
                            data: {
                                status: 'SOLD',
                                ownerId: phase.application.buyerId,
                            },
                        });

                        // Update variant counters
                        if (phase.application.propertyUnit?.variantId) {
                            await tx.propertyVariant.update({
                                where: { id: phase.application.propertyUnit.variantId },
                                data: {
                                    reservedUnits: { decrement: 1 },
                                    soldUnits: { increment: 1 },
                                },
                            });
                        }
                    }

                    // Write APPLICATION.COMPLETED domain event
                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            tenantId,
                            eventType: 'APPLICATION.COMPLETED',
                            aggregateType: 'Application',
                            aggregateId: applicationId,
                            queueName: 'notifications',
                            payload: JSON.stringify({
                                applicationId,
                                completedAt: new Date().toISOString(),
                            }),
                            actorId: userId,
                        },
                    });

                    console.log('[PhaseOrchestrator] Application completed', { applicationId });
                }
            }

            return { completedPhase, nextPhase, applicationCompleted };
        };

        // Execute in transaction if not already in one
        let result;
        if (options?.tx) {
            result = await executeInTransaction(options.tx);
        } else {
            result = await prisma.$transaction(executeInTransaction);
        }

        // Post-transaction: Publish payment phase event if next phase is PAYMENT
        if (result.nextPhase?.phaseCategory === 'PAYMENT' && result.nextPhase.paymentPhase) {
            await this.publishPaymentPhaseActivatedEvent(
                result.nextPhase,
                tenantId,
                userId
            );
        }

        return result;
    }

    /**
     * Publish PAYMENT_PHASE_ACTIVATED event to SNS for installment generation
     */
    private async publishPaymentPhaseActivatedEvent(
        phase: any,
        tenantId: string,
        userId: string
    ): Promise<void> {
        try {
            const paymentPublisher = new PaymentEventPublisher('mortgage-service');
            await paymentPublisher.publishPaymentPhaseActivated({
                phaseId: phase.id,
                applicationId: phase.applicationId,
                tenantId,
                paymentPhaseId: phase.paymentPhase.id,
                totalAmount: phase.paymentPhase.totalAmount ?? 0,
                interestRate: phase.paymentPhase.interestRate ?? 0,
                numberOfInstallments: phase.paymentPhase.numberOfInstallments ?? undefined,
                paymentPlanId: phase.paymentPhase.paymentPlanId || '',
                startDate: new Date().toISOString(),
                userId,
            });
            console.log('[PhaseOrchestrator] Published PAYMENT_PHASE_ACTIVATED event', {
                phaseId: phase.id,
                paymentPhaseId: phase.paymentPhase.id,
            });
        } catch (error) {
            console.error('[PhaseOrchestrator] Error publishing PAYMENT_PHASE_ACTIVATED:', error);
            // Don't throw - phase activation succeeded, event publishing is non-critical
        }
    }
}

export const phaseOrchestratorService = new PhaseOrchestratorService();
