import { prisma } from '../lib/prisma';
import {
    AppError,
    PhaseStatus,
    StepStatus,
    InstallmentStatus,
    PaymentStatus,
    DocumentStatus,
    computePhaseActionStatus,
    computeStepActionStatus,
    PhaseActionStatus,
    StepActionStatus,
    NextActor,
    ActionCategory,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    ActivatePhaseInput,
    CompleteStepInput,
    UploadDocumentInput,
    ApproveDocumentInput,
    GenerateInstallmentsInput,
    SubmitQuestionnaireInput,
} from '../validators/application-phase.validator';
import { handleGenerateDocumentStep } from './step-handlers';
import { paymentPlanService } from './payment-plan.service';
import {
    sendDocumentApprovedNotification,
    sendDocumentRejectedNotification,
    sendQuestionnairePhaseCompletedNotification,
    sendDocumentationPhaseCompletedNotification,
    sendPaymentPhaseCompletedNotification,
    formatDate,
} from '../lib/notifications';
import { createWorkflowBlockerService, type CreateBlockerInput } from './workflow-blocker.service';
import { unitLockingService } from './unit-locking.service';

class ApplicationPhaseService {
    async findById(phaseId: string): Promise<any> {
        const phase = await prisma.applicationPhase.findUnique({
            where: { id: phaseId },
            include: {
                application: {
                    include: {
                        buyer: true,
                        propertyUnit: {
                            include: {
                                variant: {
                                    include: {
                                        property: true,
                                    },
                                },
                            },
                        },
                    },
                },
                // Include polymorphic extensions
                questionnairePhase: {
                    include: {
                        fields: true,
                    },
                },
                documentationPhase: {
                    include: {
                        currentStep: true,
                        steps: {
                            orderBy: { order: 'asc' },
                            include: {
                                approvals: {
                                    orderBy: { decidedAt: 'desc' },
                                },
                                requiredDocuments: true,
                            },
                        },
                    },
                },
                paymentPhase: {
                    include: {
                        paymentPlan: true,
                        installments: {
                            orderBy: { installmentNumber: 'asc' },
                        },
                    },
                },
                payments: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        return phase;
    }

    /**
     * Enrich a step with action status information
     */
    enrichStepWithActionStatus(step: any): any {
        const actionStatus = computeStepActionStatus({
            id: step.id,
            name: step.name,
            stepType: step.stepType,
            order: step.order,
            status: step.status,
            actionReason: step.actionReason,
            dueDate: step.dueDate,
        });

        return {
            ...step,
            actionStatus,
        };
    }

    /**
     * Enrich a phase with action status information
     */
    enrichPhaseWithActionStatus(phase: any): any {
        // Enrich all steps with action status
        if (phase.documentationPhase?.steps) {
            phase.documentationPhase.steps = phase.documentationPhase.steps.map(
                (step: any) => this.enrichStepWithActionStatus(step)
            );
        }

        // Compute phase-level action status
        const actionStatus = computePhaseActionStatus({
            id: phase.id,
            name: phase.name,
            phaseType: phase.phaseType,
            phaseCategory: phase.phaseCategory,
            status: phase.status,
            dueDate: phase.dueDate,
            documentationPhase: phase.documentationPhase,
            paymentPhase: phase.paymentPhase,
            questionnairePhase: phase.questionnairePhase,
        });

        return {
            ...phase,
            actionStatus,
        };
    }

    /**
     * Get a phase by ID with enriched action status
     */
    async findByIdWithActionStatus(phaseId: string): Promise<any> {
        const phase = await this.findById(phaseId);
        return this.enrichPhaseWithActionStatus(phase);
    }

    // =========================================================================
    // WORKFLOW BLOCKER TRACKING
    // =========================================================================

    /**
     * Create a blocker based on the current action status of a phase
     * Called when a phase is activated or transitions to a waiting state
     */
    private async createBlockerFromActionStatus(
        phase: any,
        enrichedPhase: any,
        userId: string
    ): Promise<void> {
        const actionStatus = enrichedPhase.actionStatus;
        if (!actionStatus || actionStatus.nextActor === NextActor.NONE) {
            return; // No blocker needed
        }

        const tenantId = phase.application?.buyer?.tenantId || phase.tenantId;
        if (!tenantId) {
            console.warn('[WorkflowBlocker] Cannot create blocker - no tenantId found');
            return;
        }

        const blockerService = createWorkflowBlockerService(tenantId);

        // Determine step ID if applicable
        let stepId: string | undefined;
        if (phase.documentationPhase?.currentStepId) {
            stepId = phase.documentationPhase.currentStepId;
        }

        await blockerService.createBlocker({
            tenantId,
            applicationId: phase.applicationId,
            phaseId: phase.id,
            stepId,
            nextActor: actionStatus.nextActor,
            actionCategory: actionStatus.actionCategory,
            actionRequired: actionStatus.actionRequired,
            metadata: {
                phaseName: phase.name,
                phaseType: phase.phaseType,
                phaseCategory: phase.phaseCategory,
                stepName: stepId ? this.getStepNameById(phase, stepId) : undefined,
            },
        });
    }

    /**
     * Resolve step-level blockers when a step action is completed
     */
    private async resolveStepBlockers(
        phase: any,
        stepId: string,
        trigger: string,
        userId: string
    ): Promise<void> {
        const tenantId = phase.application?.buyer?.tenantId || phase.tenantId;
        if (!tenantId) return;

        const blockerService = createWorkflowBlockerService(tenantId);
        await blockerService.resolveStepBlockers(phase.applicationId, stepId, {
            resolvedByActor: userId,
            resolutionTrigger: trigger,
        });
    }

    /**
     * Resolve phase-level blockers when a phase is completed
     */
    private async resolvePhaseBlockers(
        phase: any,
        trigger: string,
        userId: string
    ): Promise<void> {
        const tenantId = phase.application?.buyer?.tenantId || phase.tenantId;
        if (!tenantId) return;

        const blockerService = createWorkflowBlockerService(tenantId);
        await blockerService.resolvePhaseBlockers(phase.applicationId, phase.id, {
            resolvedByActor: userId,
            resolutionTrigger: trigger,
        });
    }

    /**
     * Helper to get step name by ID
     */
    private getStepNameById(phase: any, stepId: string): string | undefined {
        const steps = phase.documentationPhase?.steps || [];
        const step = steps.find((s: any) => s.id === stepId);
        return step?.name;
    }

    /**
     * Update blockers after a phase state change
     * Resolves old blockers and creates new ones based on current action status
     */
    private async updateBlockersAfterTransition(
        phase: any,
        enrichedPhase: any,
        trigger: string,
        userId: string,
        stepId?: string
    ): Promise<void> {
        try {
            // Resolve existing blockers for the step or phase
            if (stepId) {
                await this.resolveStepBlockers(phase, stepId, trigger, userId);
            }

            // Create new blocker if phase still needs action
            await this.createBlockerFromActionStatus(phase, enrichedPhase, userId);
        } catch (error) {
            // Blocker tracking should not break the main flow
            console.error('[WorkflowBlocker] Error updating blockers:', error);
        }
    }

    // =========================================================================
    // END WORKFLOW BLOCKER TRACKING
    // =========================================================================

    /**
     * Get the next step requiring attention in a phase
     * Order of priority:
     * 1. NEEDS_RESUBMISSION / ACTION_REQUIRED (user must fix)
     * 2. PENDING / IN_PROGRESS steps in order
     */
    private getNextActionableStep(steps: any[]): any | null {
        // First check for steps needing user action (rejections)
        const needsAction = steps.find(
            (s: any) => s.status === 'NEEDS_RESUBMISSION' || s.status === 'ACTION_REQUIRED'
        );
        if (needsAction) return needsAction;

        // Then find next pending/in-progress step in order
        return steps.find(
            (s: any) => s.status === 'PENDING' || s.status === 'IN_PROGRESS' || s.status === 'AWAITING_REVIEW'
        ) || null;
    }

    /**
     * Update the currentStepId pointer on the DocumentationPhase
     */
    private async updateCurrentStepPointer(
        tx: any,
        documentationPhaseId: string,
        steps: any[]
    ): Promise<void> {
        const nextStep = this.getNextActionableStep(steps);
        await tx.documentationPhase.update({
            where: { id: documentationPhaseId },
            data: { currentStepId: nextStep?.id ?? null },
        });
    }

    async getPhasesByApplication(applicationId: string): Promise<any[]> {
        const phases = await prisma.applicationPhase.findMany({
            where: { applicationId },
            orderBy: { order: 'asc' },
            include: {
                questionnairePhase: true,
                documentationPhase: {
                    include: {
                        steps: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                paymentPhase: {
                    include: {
                        paymentPlan: true,
                        installments: {
                            orderBy: { installmentNumber: 'asc' },
                        },
                    },
                },
            },
        });
        // Enrich each phase with action status
        return phases.map((phase) => this.enrichPhaseWithActionStatus(phase));
    }

    /**
     * Get documents uploaded to a phase
     */
    async getDocumentsByPhase(phaseId: string): Promise<any[]> {
        const phase = await prisma.applicationPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        const documents = await prisma.applicationDocument.findMany({
            where: { phaseId },
            orderBy: { createdAt: 'asc' },
        });

        return documents;
    }

    /**
     * Get installments for a payment phase
     */
    async getInstallmentsByPhase(
        phaseId: string,
        filters?: { status?: string; limit?: number }
    ): Promise<any[]> {
        const phase = await prisma.applicationPhase.findUnique({
            where: { id: phaseId },
            include: {
                paymentPhase: {
                    include: {
                        installments: {
                            where: filters?.status ? { status: filters.status as InstallmentStatus } : {},
                            orderBy: { installmentNumber: 'asc' },
                            take: filters?.limit,
                        },
                    },
                },
            },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        return phase.paymentPhase?.installments ?? [];
    }

    /**
     * Activate a phase - can only activate if previous phases are completed
     */
    async activate(phaseId: string, data: ActivatePhaseInput, userId: string): Promise<any> {
        const phase = await this.findById(phaseId);

        if (phase.status !== 'PENDING') {
            throw new AppError(400, `Phase is already ${phase.status}`);
        }

        // Check if previous phase is completed (if required)
        if (phase.requiresPreviousPhaseCompletion && phase.order > 0) {
            const previousPhase = await prisma.applicationPhase.findFirst({
                where: {
                    applicationId: phase.applicationId,
                    order: phase.order - 1,
                },
            });

            // SUPERSEDED is treated as completed for the purpose of activating the next phase
            // (occurs when a phase is replaced during a payment method change)
            if (previousPhase && !['COMPLETED', 'SUPERSEDED'].includes(previousPhase.status)) {
                throw new AppError(400, 'Previous phase must be completed first');
            }
        }

        const startDate = data.startDate ? new Date(data.startDate) : new Date();

        // Determine the first step to set as current (only for DOCUMENTATION phases)
        const steps = phase.documentationPhase?.steps || [];
        const firstStep = this.getNextActionableStep(steps);

        const updated = await prisma.$transaction(async (tx) => {
            // Update phase status
            const result = await tx.applicationPhase.update({
                where: { id: phaseId },
                data: {
                    status: phase.phaseCategory === 'DOCUMENTATION' ? 'IN_PROGRESS' : 'ACTIVE',
                    activatedAt: new Date(),
                    startDate,
                },
            });

            // Update DocumentationPhase currentStepId if this is a documentation phase
            if (phase.documentationPhase && firstStep) {
                await tx.documentationPhase.update({
                    where: { id: phase.documentationPhase.id },
                    data: { currentStepId: firstStep.id },
                });

                // Mark first step as IN_PROGRESS
                if (firstStep.status === 'PENDING') {
                    await tx.documentationStep.update({
                        where: { id: firstStep.id },
                        data: { status: 'IN_PROGRESS' },
                    });
                }
            }

            // Update application's current phase
            await tx.application.update({
                where: { id: phase.applicationId },
                data: { currentPhaseId: phaseId },
            });

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application?.tenantId || phase.tenantId,
                    eventType: 'PHASE.ACTIVATED',
                    aggregateType: 'ApplicationPhase',
                    aggregateId: phaseId,
                    queueName: 'application-steps',
                    payload: JSON.stringify({
                        phaseId,
                        applicationId: phase.applicationId,
                        phaseCategory: phase.phaseCategory,
                        phaseType: phase.phaseType,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        // After activation, auto-execute any GENERATE_DOCUMENT steps that are ready
        await this.processAutoExecutableSteps(phaseId, userId);

        // Get enriched phase with action status
        const enrichedPhase = await this.findByIdWithActionStatus(updated.id);

        // Create blocker for the newly activated phase
        await this.updateBlockersAfterTransition(
            phase,
            enrichedPhase,
            'PHASE_ACTIVATED',
            userId,
            firstStep?.id
        );

        return enrichedPhase;
    }

    /**
     * Process any steps that can be auto-executed (GENERATE_DOCUMENT steps)
     * These steps don't require user action - they execute automatically when their turn comes
     */
    async processAutoExecutableSteps(phaseId: string, userId: string): Promise<void> {
        const phase = await this.findById(phaseId);

        if (phase.phaseCategory !== 'DOCUMENTATION' || !phase.documentationPhase) {
            return; // Only documentation phases have steps
        }

        const steps = phase.documentationPhase.steps || [];

        // Find the next actionable step - either PENDING or IN_PROGRESS (for auto-executable types)
        // We check IN_PROGRESS because activate() marks the first step as IN_PROGRESS
        const nextStep = steps.find(
            (s: any) => s.status === 'PENDING' || (s.status === 'IN_PROGRESS' && s.stepType === 'GENERATE_DOCUMENT')
        );
        if (!nextStep) {
            return; // No actionable steps
        }

        // Check if previous steps are completed
        const previousSteps = steps.filter((s: any) => s.order < nextStep.order);
        const allPreviousCompleted = previousSteps.every((s: any) => s.status === 'COMPLETED');

        if (!allPreviousCompleted) {
            return; // Not ready to execute this step
        }

        // If this is a GENERATE_DOCUMENT step, execute it automatically
        if (nextStep.stepType === 'GENERATE_DOCUMENT') {
            console.info('[ApplicationPhaseService] Auto-executing GENERATE_DOCUMENT step', {
                stepId: nextStep.id,
                stepName: nextStep.name,
                phaseId,
            });

            try {
                await handleGenerateDocumentStep(
                    nextStep.id,
                    phaseId,
                    phase.applicationId,
                    userId
                );

                // Recursively check for more auto-executable steps
                await this.processAutoExecutableSteps(phaseId, userId);
            } catch (error: any) {
                console.error('[ApplicationPhaseService] GENERATE_DOCUMENT step failed', {
                    stepId: nextStep.id,
                    error: error.message,
                });
                // Don't throw - allow manual retry
            }
        }
    }

    /**
     * Generate installments for a PAYMENT phase
     */
    async generateInstallments(phaseId: string, data: GenerateInstallmentsInput, userId: string): Promise<any> {
        const phase = await this.findById(phaseId);

        if (phase.phaseCategory !== 'PAYMENT' || !phase.paymentPhase) {
            throw new AppError(400, 'Can only generate installments for PAYMENT phases');
        }

        const paymentPhase = phase.paymentPhase;

        if (!paymentPhase.paymentPlanId) {
            throw new AppError(400, 'Phase has no payment plan configured');
        }

        if (paymentPhase.installments.length > 0) {
            throw new AppError(400, 'Installments already generated for this phase');
        }

        const paymentPlan = await paymentPlanService.findById(paymentPhase.paymentPlanId);
        const startDate = new Date(data.startDate);
        const interestRate = data.interestRate ?? paymentPhase.interestRate ?? 0;
        const totalAmount = paymentPhase.totalAmount ?? 0;
        const intervalDays = paymentPlanService.getIntervalDays(paymentPlan);

        // Determine number of installments: for flexible-term plans, use the user's selected term
        // For fixed-term plans, use the plan's default numberOfInstallments
        let numberOfInstallments: number;
        if (paymentPlan.allowFlexibleTerm) {
            if (!paymentPhase.numberOfInstallments) {
                throw new AppError(400, 'Flexible term plan requires selected term to be set on the phase');
            }
            numberOfInstallments = paymentPhase.numberOfInstallments;
        } else {
            if (!paymentPlan.numberOfInstallments) {
                throw new AppError(400, 'Payment plan must have numberOfInstallments configured');
            }
            numberOfInstallments = paymentPlan.numberOfInstallments;
        }

        // Calculate installment amounts using amortization
        const installments = this.calculateInstallments(
            totalAmount,
            interestRate,
            numberOfInstallments,
            startDate,
            intervalDays,
            paymentPlan.gracePeriodDays
        );

        const tenantId = phase.application.tenantId;

        await prisma.$transaction(async (tx) => {
            // Create installments
            for (const installment of installments) {
                await tx.paymentInstallment.create({
                    data: {
                        tenantId,
                        paymentPhaseId: paymentPhase.id,
                        installmentNumber: installment.installmentNumber,
                        amount: installment.amount,
                        principalAmount: installment.principalAmount,
                        interestAmount: installment.interestAmount,
                        dueDate: installment.dueDate,
                        status: 'PENDING',
                        gracePeriodDays: paymentPlan.gracePeriodDays,
                    },
                });
            }

            // Update application's next payment due date
            if (installments.length > 0) {
                await tx.application.update({
                    where: { id: phase.applicationId },
                    data: { nextPaymentDueDate: installments[0].dueDate },
                });
            }

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application?.tenantId || phase.tenantId,
                    eventType: 'INSTALLMENTS.GENERATED',
                    aggregateType: 'ApplicationPhase',
                    aggregateId: phaseId,
                    queueName: 'application-steps',
                    payload: JSON.stringify({
                        phaseId,
                        applicationId: phase.applicationId,
                        installmentCount: installments.length,
                        totalAmount,
                    }),
                    actorId: userId,
                },
            });
        });

        return this.findByIdWithActionStatus(phaseId);
    }

    /**
     * Calculate installments using standard amortization formula
     */
    private calculateInstallments(
        principal: number,
        annualRate: number,
        count: number,
        startDate: Date,
        intervalDays: number,
        gracePeriodDays: number
    ): Array<{
        installmentNumber: number;
        amount: number;
        principalAmount: number;
        interestAmount: number;
        dueDate: Date;
    }> {
        const installments: Array<{
            installmentNumber: number;
            amount: number;
            principalAmount: number;
            interestAmount: number;
            dueDate: Date;
        }> = [];

        if (count === 1) {
            // One-time payment
            installments.push({
                installmentNumber: 1,
                amount: principal,
                principalAmount: principal,
                interestAmount: 0,
                dueDate: startDate,
            });
            return installments;
        }

        // Calculate periodic rate based on interval
        // For monthly payments (30 days), use 12 periods per year for standard mortgage calculations
        let periodsPerYear: number;
        if (intervalDays === 30) {
            periodsPerYear = 12; // Standard monthly
        } else if (intervalDays === 14) {
            periodsPerYear = 26; // Biweekly
        } else if (intervalDays === 7) {
            periodsPerYear = 52; // Weekly
        } else {
            periodsPerYear = intervalDays > 0 ? 365 / intervalDays : 12;
        }
        const periodicRate = annualRate / 100 / periodsPerYear;

        // Calculate periodic payment using amortization formula
        let periodicPayment: number;
        if (periodicRate === 0) {
            periodicPayment = principal / count;
        } else {
            periodicPayment =
                (principal * periodicRate * Math.pow(1 + periodicRate, count)) /
                (Math.pow(1 + periodicRate, count) - 1);
        }

        let remainingPrincipal = principal;

        for (let i = 1; i <= count; i++) {
            const interestAmount = remainingPrincipal * periodicRate;
            const principalAmount = periodicPayment - interestAmount;
            remainingPrincipal -= principalAmount;

            // Calculate due date
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + intervalDays * i);

            installments.push({
                installmentNumber: i,
                amount: Math.round(periodicPayment * 100) / 100,
                principalAmount: Math.round(principalAmount * 100) / 100,
                interestAmount: Math.round(interestAmount * 100) / 100,
                dueDate,
            });
        }

        return installments;
    }

    /**
     * Complete a documentation step
     */
    async completeStep(phaseId: string, data: CompleteStepInput, userId: string): Promise<any> {
        const phase = await this.findById(phaseId);

        if (phase.phaseCategory !== 'DOCUMENTATION' || !phase.documentationPhase) {
            throw new AppError(400, 'Can only complete steps for DOCUMENTATION phases');
        }

        const steps = phase.documentationPhase.steps || [];
        const documentationPhaseId = phase.documentationPhase.id;

        // Find step by ID or by name
        let step = data.stepId
            ? steps.find((s: any) => s.id === data.stepId)
            : steps.find((s: any) => s.name === (data as any).stepName);

        if (!step) {
            throw new AppError(404, 'Step not found in this phase');
        }

        const stepId = step.id;

        // Check if step requires admin approval
        if (step.stepType === 'APPROVAL') {
            // APPROVAL steps can only be completed by the seller (property owner/admin)
            // The buyer cannot complete their own approval
            if (phase.application.buyerId === userId) {
                throw new AppError(403, 'This step requires admin approval');
            }
        }

        if (step.status === 'COMPLETED') {
            throw new AppError(400, 'Step already completed');
        }

        const tenantId = phase.application.tenantId;

        await prisma.$transaction(async (tx) => {
            // Update step status
            await tx.documentationStep.update({
                where: { id: stepId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            // Create approval record if decision provided
            if (data.decision) {
                await tx.documentationStepApproval.create({
                    data: {
                        tenantId,
                        stepId: stepId,
                        approverId: userId,
                        decision: data.decision,
                        comment: data.comment,
                    },
                });
            }

            // Check if all steps are completed
            const remainingSteps = await tx.documentationStep.findMany({
                where: {
                    documentationPhaseId,
                    status: { notIn: ['COMPLETED', 'SKIPPED'] },
                    id: { not: stepId },
                },
                orderBy: { order: 'asc' },
            });

            if (remainingSteps.length === 0) {
                // All steps completed - complete the phase and clear currentStepId
                await tx.applicationPhase.update({
                    where: { id: phaseId },
                    data: {
                        status: 'COMPLETED',
                        completedAt: new Date(),
                    },
                });

                // Clear the currentStepId on DocumentationPhase
                if (phase.documentationPhase) {
                    await tx.documentationPhase.update({
                        where: { id: phase.documentationPhase.id },
                        data: { currentStepId: null },
                    });
                }

                // Write phase completed event
                await tx.domainEvent.create({
                    data: {
                        id: uuidv4(),
                        tenantId: phase.application?.tenantId || phase.tenantId,
                        eventType: 'PHASE.COMPLETED',
                        aggregateType: 'ApplicationPhase',
                        aggregateId: phaseId,
                        queueName: 'application-steps',
                        payload: JSON.stringify({
                            phaseId,
                            applicationId: phase.applicationId,
                            phaseType: phase.phaseType,
                        }),
                        actorId: userId,
                    },
                });

                // Auto-activate next phase
                const nextPhase = await tx.applicationPhase.findFirst({
                    where: {
                        applicationId: phase.applicationId,
                        order: phase.order + 1,
                    },
                });

                if (nextPhase) {
                    await tx.applicationPhase.update({
                        where: { id: nextPhase.id },
                        data: {
                            status: 'IN_PROGRESS',
                        },
                    });

                    // Update application's current phase
                    await tx.application.update({
                        where: { id: phase.applicationId },
                        data: { currentPhaseId: nextPhase.id },
                    });

                    // Write phase activated event
                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            tenantId: phase.application?.tenantId || phase.tenantId,
                            eventType: 'PHASE.ACTIVATED',
                            aggregateType: 'ApplicationPhase',
                            aggregateId: nextPhase.id,
                            queueName: 'application-steps',
                            payload: JSON.stringify({
                                phaseId: nextPhase.id,
                                applicationId: phase.applicationId,
                                phaseType: nextPhase.phaseType,
                            }),
                            actorId: userId,
                        },
                    });
                }

                // Handle unit locking if this phase is configured to lock on complete
                await this.handleUnitLockingOnPhaseComplete(tx, phaseId, userId);

                // Send phase completion notification (fire and forget, outside tx)
                this.sendPhaseCompletionNotification(phaseId);
            } else {
                // Advance currentStepId to the next actionable step
                const nextStep = remainingSteps[0];

                // Update currentStepId on DocumentationPhase
                if (phase.documentationPhase) {
                    await tx.documentationPhase.update({
                        where: { id: phase.documentationPhase.id },
                        data: { currentStepId: nextStep.id },
                    });
                }

                // Mark the next step as IN_PROGRESS if it's PENDING
                if (nextStep.status === 'PENDING') {
                    await tx.documentationStep.update({
                        where: { id: nextStep.id },
                        data: { status: 'IN_PROGRESS' },
                    });
                }
            }

            // Write step completed event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application?.tenantId || phase.tenantId,
                    eventType: 'PHASE.STEP.COMPLETED',
                    aggregateType: 'DocumentationStep',
                    aggregateId: stepId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        stepId: stepId,
                        phaseId,
                        applicationId: phase.applicationId,
                        decision: data.decision,
                    }),
                    actorId: userId,
                },
            });
        });

        // After completing a step, check for auto-executable next steps
        await this.processAutoExecutableSteps(phaseId, userId);

        return this.findByIdWithActionStatus(phaseId);
    }

    /**
     * Upload a document for a phase/step
     * 
     * State Machine Logic:
     * - Auto-detect matching UPLOAD step based on document type or step name
     * - If step is UPLOAD type, auto-complete step when document is uploaded
     * - Check for phase completion after step completion
     */
    async uploadDocument(phaseId: string, data: UploadDocumentInput, userId: string) {
        const phase = await this.findById(phaseId);

        const document = await prisma.$transaction(async (tx) => {
            // Auto-detect stepId if not provided
            let stepId = data.stepId;
            if (!stepId && phase.documentationPhase) {
                // Try to find matching UPLOAD step based on document type
                const steps = phase.documentationPhase.steps || [];
                const docType = data.type?.toUpperCase() || '';

                // Match step by name containing the document type (e.g., "Upload Valid ID" for ID_CARD)
                const matchingStep = steps.find((s: any) => {
                    if (s.stepType !== 'UPLOAD' || s.status === 'COMPLETED') return false;

                    const stepNameUpper = s.name.toUpperCase();
                    // Common mappings
                    if (docType.includes('ID') && (stepNameUpper.includes('ID') || stepNameUpper.includes('IDENTIFICATION'))) return true;
                    if (docType.includes('BANK') && stepNameUpper.includes('BANK')) return true;
                    if (docType.includes('EMPLOYMENT') && stepNameUpper.includes('EMPLOYMENT')) return true;
                    if (docType.includes('OFFER') && stepNameUpper.includes('OFFER')) return true;

                    // Fallback: check if step name contains doc type
                    return stepNameUpper.includes(docType.replace('_', ' ')) ||
                        stepNameUpper.includes(docType.replace('_', ''));
                });

                if (matchingStep) {
                    stepId = matchingStep.id;
                }
            }

            // Create the document with resolved stepId
            const doc = await tx.applicationDocument.create({
                data: {
                    tenantId: phase.application.tenantId,
                    applicationId: phase.applicationId,
                    phaseId,
                    stepId,
                    name: data.name,
                    url: data.url,
                    type: data.type,
                    uploadedById: userId,
                    status: 'PENDING',
                },
            });

            // If step is identified, evaluate automatic step completion
            if (stepId) {
                const step = await tx.documentationStep.findUnique({
                    where: { id: stepId },
                    include: { requiredDocuments: true },
                });

                if (step && step.stepType === 'UPLOAD') {
                    // For UPLOAD steps: Mark as AWAITING_REVIEW when document is uploaded
                    // Step will be COMPLETED when the document is approved
                    if (step.status !== 'COMPLETED') {
                        await tx.documentationStep.update({
                            where: { id: stepId },
                            data: {
                                status: 'AWAITING_REVIEW',
                                submissionCount: { increment: 1 },
                                lastSubmittedAt: new Date(),
                            },
                        });
                    }
                } else if (step) {
                    // For non-UPLOAD steps: Just track submission
                    const newStatus = step.status === 'NEEDS_RESUBMISSION' ? 'AWAITING_REVIEW' : 'IN_PROGRESS';
                    await tx.documentationStep.update({
                        where: { id: stepId },
                        data: {
                            status: newStatus,
                            submissionCount: { increment: 1 },
                            lastSubmittedAt: new Date(),
                            actionReason: step.status === 'NEEDS_RESUBMISSION' ? null : step.actionReason,
                        },
                    });
                }
            }

            return doc;
        });

        // After transaction, check for auto-executable steps (like GENERATE_DOCUMENT)
        await this.processAutoExecutableSteps(phaseId, userId);

        // Return document with current phase action status
        const updatedPhase = await this.findByIdWithActionStatus(phaseId);

        // Track blocker transition (upload completed, may now await review)
        const resolvedStepId = document.stepId;
        if (resolvedStepId) {
            await this.updateBlockersAfterTransition(
                phase,
                updatedPhase,
                'DOCUMENT_UPLOADED',
                userId,
                resolvedStepId
            );
        }

        return {
            document,
            phaseActionStatus: updatedPhase.actionStatus,
        };
    }

    /**
     * Reject a step - marks it as NEEDS_RESUBMISSION with reason
     * Used when admin reviews and finds issues with submitted documents
     */
    async rejectStep(
        phaseId: string,
        stepId: string,
        reason: string,
        userId: string
    ): Promise<any> {
        const phase = await this.findById(phaseId);

        if (!phase.documentationPhase) {
            throw new AppError(400, 'Can only reject steps for DOCUMENTATION phases');
        }

        const steps = phase.documentationPhase.steps || [];
        const step = steps.find((s: any) => s.id === stepId);
        if (!step) {
            throw new AppError(404, 'Step not found in this phase');
        }

        if (step.status === 'COMPLETED') {
            throw new AppError(400, 'Cannot reject a completed step');
        }

        const tenantId = phase.application.tenantId;

        await prisma.$transaction(async (tx) => {
            // Update step to NEEDS_RESUBMISSION with reason
            await tx.documentationStep.update({
                where: { id: stepId },
                data: {
                    status: 'NEEDS_RESUBMISSION',
                    actionReason: reason,
                },
            });

            // Create approval record with REJECTED decision
            await tx.documentationStepApproval.create({
                data: {
                    tenantId,
                    stepId,
                    approverId: userId,
                    decision: 'REJECTED',
                    comment: reason,
                },
            });

            // Set currentStepId on DocumentationPhase (user needs to fix it)
            await tx.documentationPhase.update({
                where: { id: phase.documentationPhase.id },
                data: { currentStepId: stepId },
            });

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application?.tenantId || phase.tenantId,
                    eventType: 'PHASE.STEP.REJECTED',
                    aggregateType: 'DocumentationStep',
                    aggregateId: stepId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        stepId,
                        phaseId,
                        applicationId: phase.applicationId,
                        reason,
                    }),
                    actorId: userId,
                },
            });
        });

        // Send rejection notification to the buyer
        const buyer = phase.application?.buyer;
        const propertyName = phase.application?.propertyUnit?.variant?.property?.title;
        if (buyer?.email) {
            const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.qshelter.com';
            await sendDocumentRejectedNotification({
                email: buyer.email,
                userName: buyer.firstName || buyer.email,
                documentName: step.name,
                stepName: step.name,
                applicationNumber: phase.application?.applicationNumber || '',
                propertyName,
                reason: reason,
                dashboardUrl: `${dashboardUrl}/applications/${phase.applicationId}`,
            }).catch((err) => {
                console.error('[ApplicationPhaseService] Failed to send step rejected notification', err);
            });
        }

        // Track blocker transition (step rejected, customer must resubmit)
        const enrichedPhase = await this.findByIdWithActionStatus(phaseId);
        await this.updateBlockersAfterTransition(
            phase,
            enrichedPhase,
            'STEP_REJECTED',
            userId,
            stepId
        );

        return enrichedPhase;
    }

    /**
     * Request changes on a step - marks it as ACTION_REQUIRED
     * Similar to reject but with REQUEST_CHANGES decision
     */
    async requestStepChanges(
        phaseId: string,
        stepId: string,
        reason: string,
        userId: string
    ): Promise<any> {
        const phase = await this.findById(phaseId);

        if (!phase.documentationPhase) {
            throw new AppError(400, 'Can only request changes for DOCUMENTATION phases');
        }

        const steps = phase.documentationPhase.steps || [];
        const step = steps.find((s: any) => s.id === stepId);
        if (!step) {
            throw new AppError(404, 'Step not found in this phase');
        }

        if (step.status === 'COMPLETED') {
            throw new AppError(400, 'Cannot request changes on a completed step');
        }

        const tenantId = phase.application.tenantId;

        await prisma.$transaction(async (tx) => {
            // Update step to ACTION_REQUIRED with reason
            await tx.documentationStep.update({
                where: { id: stepId },
                data: {
                    status: 'ACTION_REQUIRED',
                    actionReason: reason,
                },
            });

            // Create approval record with REQUEST_CHANGES decision
            await tx.documentationStepApproval.create({
                data: {
                    tenantId,
                    stepId,
                    approverId: userId,
                    decision: 'REQUEST_CHANGES',
                    comment: reason,
                },
            });

            // Set currentStepId on DocumentationPhase (user needs to address it)
            await tx.documentationPhase.update({
                where: { id: phase.documentationPhase.id },
                data: { currentStepId: stepId },
            });

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application?.tenantId || phase.tenantId,
                    eventType: 'PHASE.STEP.CHANGES_REQUESTED',
                    aggregateType: 'DocumentationStep',
                    aggregateId: stepId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        stepId,
                        phaseId,
                        applicationId: phase.applicationId,
                        reason,
                    }),
                    actorId: userId,
                },
            });
        });

        return this.findByIdWithActionStatus(phaseId);
    }

    /**
     * Approve or reject a document
     * 
     * State Machine Logic:
     * - When all documents in a phase are APPROVED, auto-complete the APPROVAL step
     * - Check for phase completion after step completion
     */
    async approveDocument(documentId: string, data: ApproveDocumentInput, userId: string) {
        // Get document with full context for notifications
        const document = await prisma.applicationDocument.findUnique({
            where: { id: documentId },
            include: {
                application: {
                    include: {
                        buyer: true,
                        propertyUnit: {
                            include: {
                                variant: {
                                    include: {
                                        property: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!document) {
            throw new AppError(404, 'Document not found');
        }

        // Get step name if stepId is present
        let stepName = 'Document Submission';
        if (document.stepId) {
            const step = await prisma.documentationStep.findUnique({
                where: { id: document.stepId },
                select: { name: true },
            });
            if (step) {
                stepName = step.name;
            }
        }

        await prisma.$transaction(async (tx) => {
            // Update document status
            await tx.applicationDocument.update({
                where: { id: documentId },
                data: {
                    status: data.status,
                },
            });

            // If document is rejected and has a stepId, revert the step to NEEDS_RESUBMISSION
            if (data.status === 'REJECTED' && document.stepId) {
                await tx.documentationStep.update({
                    where: { id: document.stepId },
                    data: {
                        status: 'NEEDS_RESUBMISSION',
                        actionReason: data.comment || 'Document was rejected. Please resubmit.',
                    },
                });
            }

            // State Machine: Complete the UPLOAD step for this document and check APPROVAL step
            if (data.status === 'APPROVED') {
                // Complete the UPLOAD step for this specific document
                if (document.stepId) {
                    const step = await tx.documentationStep.findUnique({
                        where: { id: document.stepId },
                    });
                    if (step && step.stepType === 'UPLOAD' && step.status !== 'COMPLETED') {
                        await tx.documentationStep.update({
                            where: { id: document.stepId },
                            data: {
                                status: 'COMPLETED',
                                completedAt: new Date(),
                            },
                        });
                    }
                }
                // Check if all documents approved → auto-complete APPROVAL step
                if (document.phaseId) {
                    await this.evaluateApprovalStepCompletion(tx, document.phaseId, userId);
                }
            }
        });

        // Send notification to the buyer (outside transaction)
        const buyer = document.application?.buyer;
        const propertyName = document.application?.propertyUnit?.variant?.property?.title;
        if (buyer?.email) {
            const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.qshelter.com';

            if (data.status === 'APPROVED') {
                await sendDocumentApprovedNotification({
                    email: buyer.email,
                    userName: buyer.firstName || buyer.email,
                    documentName: document.name,
                    stepName,
                    applicationNumber: document.application?.applicationNumber || '',
                    propertyName,
                    approvedDate: formatDate(new Date()),
                    dashboardUrl: `${dashboardUrl}/applications/${document.applicationId}`,
                }).catch((err) => {
                    console.error('[ApplicationPhaseService] Failed to send document approved notification', err);
                });
            } else if (data.status === 'REJECTED') {
                await sendDocumentRejectedNotification({
                    email: buyer.email,
                    userName: buyer.firstName || buyer.email,
                    documentName: document.name,
                    stepName,
                    applicationNumber: document.application?.applicationNumber || '',
                    propertyName,
                    reason: data.comment || 'Please resubmit with the correct document.',
                    dashboardUrl: `${dashboardUrl}/applications/${document.applicationId}`,
                }).catch((err) => {
                    console.error('[ApplicationPhaseService] Failed to send document rejected notification', err);
                });
            }
        }

        // After approval, check for auto-executable steps (like GENERATE_DOCUMENT)
        if (data.status === 'APPROVED' && document.phaseId) {
            await this.processAutoExecutableSteps(document.phaseId, userId);
        }

        // Return updated document with phase action status
        const updatedDocument = await prisma.applicationDocument.findUnique({
            where: { id: documentId },
        });

        // Get phase action status if document has phaseId
        let phaseActionStatus = null;
        if (document.phaseId) {
            const phase = await this.findByIdWithActionStatus(document.phaseId);
            phaseActionStatus = phase.actionStatus;
        }

        return {
            ...updatedDocument,
            phaseActionStatus,
        };
    }

    /**
     * Evaluate if APPROVAL step should auto-complete
     * Criteria: All documents in the phase are APPROVED
     */
    private async evaluateApprovalStepCompletion(tx: any, phaseId: string, userId: string) {
        // Get all documents in this phase
        const documents = await tx.applicationDocument.findMany({
            where: { phaseId },
        });

        // Check if all documents are approved
        const allApproved = documents.length > 0 && documents.every((d: any) => d.status === 'APPROVED');

        if (!allApproved) return;

        // Find the APPROVAL step in this phase
        const phase = await tx.applicationPhase.findUnique({
            where: { id: phaseId },
            include: {
                documentationPhase: {
                    include: {
                        steps: true,
                    },
                },
            },
        });

        if (!phase?.documentationPhase) return;

        const approvalStep = phase.documentationPhase.steps.find(
            (s: any) => s.stepType === 'APPROVAL' && s.status !== 'COMPLETED'
        );

        if (approvalStep) {
            await tx.documentationStep.update({
                where: { id: approvalStep.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            // Check for phase completion
            await this.evaluatePhaseCompletionInternal(tx, phaseId, userId);
        }
    }

    /**
     * Handle unit locking after phase completion.
     * This is called after a phase is marked complete to check if it should trigger unit locking.
     * 
     * @param tx - Transaction context (optional, uses prisma if not provided)
     * @param phaseId - The application phase that was completed
     * @param userId - The actor who triggered the completion
     */
    private async handleUnitLockingOnPhaseComplete(
        tx: any | null,
        phaseId: string,
        userId: string
    ): Promise<void> {
        const db = tx || prisma;

        // Get the phase with its template reference
        const phase = await db.applicationPhase.findUnique({
            where: { id: phaseId },
            include: {
                phaseTemplate: {
                    select: { lockUnitOnComplete: true },
                },
                application: {
                    select: { id: true, tenantId: true },
                },
            },
        });

        if (!phase?.phaseTemplate?.lockUnitOnComplete) {
            return; // This phase is not configured to lock units
        }

        // Lock the unit and supersede competing applications
        try {
            const result = await unitLockingService.lockUnitForApplication(
                phase.application.tenantId,
                phase.application.id,
                userId
            );

            // Log the lock event
            await db.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application.tenantId,
                    eventType: 'UNIT.LOCKED',
                    aggregateType: 'PropertyUnit',
                    aggregateId: result.lockedUnit.id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        unitId: result.lockedUnit.id,
                        applicationId: phase.application.id,
                        phaseId,
                        supersededCount: result.supersededCount,
                        supersededApplicationIds: result.supersededApplicationIds,
                    }),
                    actorId: userId,
                },
            });
        } catch (error: any) {
            // If unit is already locked by someone else, this is a conflict
            if (error.statusCode === 409) {
                throw error; // Re-throw conflict errors
            }
            // For other errors, log but don't fail the phase completion
            console.error('Unit locking failed:', error.message);
        }
    }

    /**
     * Send phase completion notification based on phase category.
     * Sends the appropriate notification type (questionnaire, documentation, or payment).
     * 
     * @param phaseId - The application phase that was completed
     */
    private async sendPhaseCompletionNotification(phaseId: string): Promise<void> {
        try {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: phaseId },
                include: {
                    application: {
                        include: {
                            buyer: true,
                            propertyUnit: {
                                include: {
                                    variant: {
                                        include: { property: true },
                                    },
                                },
                            },
                        },
                    },
                    questionnairePhase: true,
                    documentationPhase: {
                        include: { steps: true },
                    },
                    paymentPhase: {
                        include: { installments: true },
                    },
                },
            });

            if (!phase?.application?.buyer?.email) {
                console.log('[ApplicationPhaseService] No buyer email for phase completion notification');
                return;
            }

            const buyer = phase.application.buyer;
            const property = phase.application.propertyUnit?.variant?.property;
            const unit = phase.application.propertyUnit;
            const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.qshelter.com';

            const basePayload = {
                email: buyer.email,
                userName: buyer.firstName || buyer.email,
                applicationNumber: phase.application.applicationNumber || '',
                propertyName: property?.title || 'Property',
                unitNumber: unit?.unitNumber || '',
                phaseName: phase.name,
                dashboardUrl: `${dashboardUrl}/applications/${phase.applicationId}`,
            };

            switch (phase.phaseCategory) {
                case 'QUESTIONNAIRE':
                    await sendQuestionnairePhaseCompletedNotification({
                        ...basePayload,
                        score: phase.questionnairePhase?.totalScore ?? undefined,
                        maxScore: phase.questionnairePhase?.passingScore ?? undefined,
                        passed: phase.questionnairePhase?.passed ?? true,
                    });
                    break;

                case 'DOCUMENTATION':
                    const stepsCount = phase.documentationPhase?.steps?.length ?? 0;
                    await sendDocumentationPhaseCompletedNotification({
                        ...basePayload,
                        stepsCompleted: stepsCount,
                    });
                    break;

                case 'PAYMENT':
                    const installments = phase.paymentPhase?.installments ?? [];
                    const paidInstallments = installments.filter((i: any) => 
                        i.status === 'PAID' || i.status === 'WAIVED'
                    );
                    const totalPaid = phase.paymentPhase?.paidAmount ?? 0;
                    await sendPaymentPhaseCompletedNotification({
                        ...basePayload,
                        totalPaid: `₦${totalPaid.toLocaleString()}`,
                        installmentsPaid: paidInstallments.length,
                    });
                    break;

                default:
                    console.log(`[ApplicationPhaseService] Unknown phase category: ${phase.phaseCategory}`);
            }
        } catch (error) {
            // Don't fail phase completion if notification fails
            console.error('[ApplicationPhaseService] Failed to send phase completion notification:', error);
        }
    }

    /**
     * Evaluate phase completion within a transaction
     * Criteria: All steps are COMPLETED or SKIPPED
     */
    private async evaluatePhaseCompletionInternal(tx: any, phaseId: string, userId: string) {
        const phase = await tx.applicationPhase.findUnique({
            where: { id: phaseId },
            include: {
                documentationPhase: {
                    include: { steps: true },
                },
            },
        });

        if (!phase?.documentationPhase) return;
        if (phase.status === 'COMPLETED') return;

        const steps = phase.documentationPhase.steps || [];
        const incompleteSteps = steps.filter(
            (s: any) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED'
        );

        if (incompleteSteps.length > 0) return;

        // All steps completed → complete phase and auto-activate next
        await tx.applicationPhase.update({
            where: { id: phaseId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        });

        // Clear currentStepId
        await tx.documentationPhase.update({
            where: { id: phase.documentationPhase.id },
            data: { currentStepId: null },
        });

        // Write phase completed event
        await tx.domainEvent.create({
            data: {
                id: uuidv4(),
                tenantId: phase.application?.tenantId || phase.tenantId,
                eventType: 'PHASE.COMPLETED',
                aggregateType: 'ApplicationPhase',
                aggregateId: phaseId,
                queueName: 'application-steps',
                payload: JSON.stringify({
                    phaseId,
                    applicationId: phase.applicationId,
                    phaseType: phase.phaseType,
                }),
                actorId: userId,
            },
        });

        // Auto-activate next phase
        const nextPhase = await tx.applicationPhase.findFirst({
            where: {
                applicationId: phase.applicationId,
                order: phase.order + 1,
            },
        });

        if (nextPhase) {
            await tx.applicationPhase.update({
                where: { id: nextPhase.id },
                data: { status: 'IN_PROGRESS' },
            });

            await tx.application.update({
                where: { id: phase.applicationId },
                data: { currentPhaseId: nextPhase.id },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application?.tenantId || phase.tenantId,
                    eventType: 'PHASE.ACTIVATED',
                    aggregateType: 'ApplicationPhase',
                    aggregateId: nextPhase.id,
                    queueName: 'application-steps',
                    payload: JSON.stringify({
                        phaseId: nextPhase.id,
                        applicationId: phase.applicationId,
                        phaseType: nextPhase.phaseType,
                    }),
                    actorId: userId,
                },
            });
        }

        // Handle unit locking if this phase is configured to lock on complete
        await this.handleUnitLockingOnPhaseComplete(tx, phaseId, userId);

        // Send phase completion notification (fire and forget, outside tx)
        this.sendPhaseCompletionNotification(phaseId);
    }

    /**
     * Complete a phase manually
     */
    async complete(phaseId: string, userId: string): Promise<any> {
        const phase = await this.findById(phaseId);

        if (phase.status === 'COMPLETED') {
            throw new AppError(400, 'Phase already completed');
        }

        // For PAYMENT phases, check if all installments are paid
        if (phase.phaseCategory === 'PAYMENT' && phase.paymentPhase) {
            const installments = phase.paymentPhase.installments || [];
            const unpaidInstallments = installments.filter(
                (i: any) => i.status !== 'PAID' && i.status !== 'WAIVED'
            );
            if (unpaidInstallments.length > 0) {
                throw new AppError(400, `${unpaidInstallments.length} installments still unpaid`);
            }
        }

        // For DOCUMENTATION phases, check if all steps are completed
        if (phase.phaseCategory === 'DOCUMENTATION' && phase.documentationPhase) {
            const steps = phase.documentationPhase.steps || [];
            const incompleteSteps = steps.filter(
                (s: any) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED'
            );
            if (incompleteSteps.length > 0) {
                throw new AppError(400, `${incompleteSteps.length} steps still incomplete`);
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.applicationPhase.update({
                where: { id: phaseId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            // Update PaymentPhase paidAmount if this is a payment phase
            if (phase.paymentPhase) {
                await tx.paymentPhase.update({
                    where: { id: phase.paymentPhase.id },
                    data: {
                        paidAmount: phase.paymentPhase.totalAmount ?? 0,
                    },
                });
            }

            // Check if all phases are completed
            const incompletePhasesCount = await tx.applicationPhase.count({
                where: {
                    applicationId: phase.applicationId,
                    status: { notIn: ['COMPLETED', 'SKIPPED'] },
                    id: { not: phaseId },
                },
            });

            if (incompletePhasesCount === 0) {
                // All phases completed - complete the application
                await tx.application.update({
                    where: { id: phase.applicationId },
                    data: {
                        status: 'COMPLETED',
                    },
                });

                await tx.domainEvent.create({
                    data: {
                        id: uuidv4(),
                        tenantId: phase.application?.tenantId || phase.tenantId,
                        eventType: 'APPLICATION.COMPLETED',
                        aggregateType: 'Application',
                        aggregateId: phase.applicationId,
                        queueName: 'notifications',
                        payload: JSON.stringify({ applicationId: phase.applicationId }),
                        actorId: userId,
                    },
                });
            }

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application?.tenantId || phase.tenantId,
                    eventType: 'PHASE.COMPLETED',
                    aggregateType: 'ApplicationPhase',
                    aggregateId: phaseId,
                    queueName: 'application-steps',
                    payload: JSON.stringify({
                        phaseId,
                        applicationId: phase.applicationId,
                        phaseType: phase.phaseType,
                    }),
                    actorId: userId,
                },
            });

            // Handle unit locking if this phase is configured to lock on complete
            await this.handleUnitLockingOnPhaseComplete(tx, phaseId, userId);

            return result;
        });

        // Send phase completion notification (fire and forget, outside tx)
        this.sendPhaseCompletionNotification(phaseId);

        return this.findByIdWithActionStatus(updated.id);
    }

    /**
     * Submit questionnaire answers for a QUESTIONNAIRE phase.
     * Validates answers, calculates scores based on the QuestionnairePlan,
     * and optionally auto-completes the phase if scoring passes.
     */
    async submitQuestionnaire(phaseId: string, data: SubmitQuestionnaireInput, userId: string): Promise<any> {
        const phase = await this.findById(phaseId);

        if (phase.phaseCategory !== 'QUESTIONNAIRE') {
            throw new AppError(400, 'This endpoint is only for QUESTIONNAIRE phases');
        }

        if (phase.status !== 'IN_PROGRESS') {
            throw new AppError(400, 'Phase must be IN_PROGRESS to submit questionnaire');
        }

        if (!phase.questionnairePhase) {
            throw new AppError(400, 'Questionnaire phase data not found');
        }

        const questionnairePhase = phase.questionnairePhase;
        const fields = questionnairePhase.fields || [];

        // Map answers by field name for easy lookup
        const answerMap = new Map(data.answers.map((a) => [a.fieldName, a.value]));

        // Validate that all required fields have answers
        const missingFields: string[] = [];
        for (const field of fields) {
            if (field.isRequired && !answerMap.has(field.name)) {
                missingFields.push(field.name);
            }
        }

        if (missingFields.length > 0) {
            throw new AppError(400, `Missing required fields: ${missingFields.join(', ')}`);
        }

        // Get the questionnaire plan for scoring rules (if exists)
        let questionnairePlan: any = null;
        if (questionnairePhase.questionnairePlanId) {
            questionnairePlan = await prisma.questionnairePlan.findUnique({
                where: { id: questionnairePhase.questionnairePlanId },
                include: { questions: true },
            });
        }

        // Calculate score based on scoring strategy
        let totalScore = 0;
        let allPassed = true;
        const fieldScores: Record<string, { score: number; passed: boolean }> = {};

        for (const field of fields) {
            const answer = answerMap.get(field.name);
            if (answer === undefined) continue;

            // Find the corresponding question from the plan for scoring rules
            const question = questionnairePlan?.questions?.find((q: any) => q.questionKey === field.name);

            let fieldScore = 0;
            let fieldPassed = true;

            if (question?.scoringRules) {
                const rules = question.scoringRules as Record<string, any>;

                // Handle different scoring rule types
                if (typeof rules === 'object') {
                    // Direct value mapping: { "employed": 10, "unemployed": 0 }
                    if (rules[String(answer)] !== undefined) {
                        fieldScore = Number(rules[String(answer)]) || 0;
                    }
                    // Range-based scoring: { min: 0, max: 100, minScore: 0, maxScore: 10 }
                    else if (rules.min !== undefined && rules.max !== undefined && typeof answer === 'number') {
                        const value = Number(answer);
                        if (value >= rules.min && value <= rules.max) {
                            fieldScore = rules.score || 10;
                        } else {
                            fieldPassed = false;
                        }
                    }
                    // Pass/fail threshold: { minValue: 18, score: 10 }
                    else if (rules.minValue !== undefined) {
                        const value = Number(answer);
                        if (value >= rules.minValue) {
                            fieldScore = rules.score || 10;
                        } else {
                            fieldPassed = false;
                        }
                    }
                    // Max value threshold: { maxValue: 60, score: 10 }
                    else if (rules.maxValue !== undefined) {
                        const value = Number(answer);
                        if (value <= rules.maxValue) {
                            fieldScore = rules.score || 10;
                        } else {
                            fieldPassed = false;
                        }
                    }
                }
            } else {
                // No scoring rules - field just needs to be answered
                fieldScore = 1;
            }

            // Apply score weight from question
            const weight = question?.scoreWeight || 1;
            fieldScore *= weight;

            totalScore += fieldScore;
            fieldScores[field.name] = { score: fieldScore, passed: fieldPassed };

            if (!fieldPassed) {
                allPassed = false;
            }
        }

        // Determine if passed based on scoring strategy
        const scoringStrategy = questionnairePlan?.scoringStrategy || 'SUM';
        const passingScore = questionnairePhase.passingScore || questionnairePlan?.passingScore || 0;
        let passed = false;

        switch (scoringStrategy) {
            case 'MIN_ALL':
                // All fields must pass their individual validation
                passed = allPassed;
                break;
            case 'SUM':
                // Total score must meet passing threshold
                passed = totalScore >= passingScore;
                break;
            case 'AVERAGE':
                const avgScore = fields.length > 0 ? totalScore / fields.length : 0;
                passed = avgScore >= passingScore;
                break;
            case 'WEIGHTED_SUM':
                passed = totalScore >= passingScore;
                break;
            default:
                passed = totalScore >= passingScore;
        }

        const now = new Date();

        // Update all fields with their answers
        const updated = await prisma.$transaction(async (tx) => {
            // Update each field with its answer
            for (const field of fields) {
                const answer = answerMap.get(field.name);
                if (answer !== undefined) {
                    await tx.questionnaireField.update({
                        where: { id: field.id },
                        data: {
                            answer: JSON.stringify(answer),
                            isValid: fieldScores[field.name]?.passed ?? true,
                            submittedAt: now,
                        },
                    });
                }
            }

            // Update the questionnaire phase with scoring results
            await tx.questionnairePhase.update({
                where: { id: questionnairePhase.id },
                data: {
                    completedFieldsCount: data.answers.length,
                    totalScore,
                    passed,
                    scoredAt: now,
                },
            });

            // If auto-decision is enabled and passed, complete the phase
            const autoComplete = questionnairePlan?.autoDecisionEnabled && passed;

            if (autoComplete) {
                await tx.applicationPhase.update({
                    where: { id: phaseId },
                    data: {
                        status: 'COMPLETED',
                        completedAt: now,
                    },
                });
            }

            // Create domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.tenantId,
                    eventType: 'QUESTIONNAIRE.SUBMITTED',
                    aggregateType: 'ApplicationPhase',
                    aggregateId: phaseId,
                    queueName: 'application-steps',
                    payload: JSON.stringify({
                        phaseId,
                        applicationId: phase.applicationId,
                        totalScore,
                        passed,
                        scoringStrategy,
                        autoCompleted: autoComplete,
                        fieldScores,
                    }),
                    actorId: userId,
                },
            });

            return { autoComplete };
        });

        // Return the updated phase with questionnaire data
        const result = await this.findById(phaseId);
        return {
            ...result,
            questionnaire: {
                completedAt: now,
                answeredFieldsCount: data.answers.length,
                totalFieldsCount: fields.length,
                totalScore,
                passed,
                scoringStrategy,
                autoCompleted: updated.autoComplete,
            },
        };
    }

    /**
     * Skip a phase (admin action)
     */
    async skip(phaseId: string, userId: string, reason?: string): Promise<any> {
        const phase = await this.findById(phaseId);

        if (phase.status !== 'PENDING') {
            throw new AppError(400, 'Can only skip pending phases');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.applicationPhase.update({
                where: { id: phaseId },
                data: {
                    status: 'SKIPPED',
                    completedAt: new Date(),
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: phase.application?.tenantId || phase.tenantId,
                    eventType: 'PHASE.SKIPPED',
                    aggregateType: 'ApplicationPhase',
                    aggregateId: phaseId,
                    queueName: 'application-steps',
                    payload: JSON.stringify({
                        phaseId,
                        applicationId: phase.applicationId,
                        reason,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        return this.findByIdWithActionStatus(updated.id);
    }
}

export const applicationPhaseService = new ApplicationPhaseService();
