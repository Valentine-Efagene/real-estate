import { prisma } from '../lib/prisma';
import {
    AppError,
    PhaseStatus,
    StageStatus,
    InstallmentStatus,
    PaymentStatus,
    DocumentStatus,
    computePhaseActionStatus,
    ReviewParty,
    ReviewDecision,
    RejectionBehavior,
    NextActor,
    ConditionOperator,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    ActivatePhaseInput,
    UploadDocumentInput,
    ApproveDocumentInput,
    GenerateInstallmentsInput,
    SubmitQuestionnaireInput,
} from '../validators/application-phase.validator';
import { createConditionEvaluatorService } from './condition-evaluator.service';
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
import { approvalWorkflowService, type ApprovalStageSnapshot } from './approval-workflow.service';

// Type for scoring rules
interface ScoringRule {
    operator: ConditionOperator;
    value: number | boolean | string;
    score: number;
}

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
                        documents: {
                            orderBy: { createdAt: 'desc' },
                            include: {
                                approvalTrail: {
                                    orderBy: { createdAt: 'desc' },
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
                        documentationPlan: {
                            include: {
                                documentDefinitions: {
                                    orderBy: { order: 'asc' },
                                },
                                approvalStages: {
                                    orderBy: { order: 'asc' },
                                },
                            },
                        },
                        stageProgress: {
                            orderBy: { order: 'asc' },
                            include: {
                                documentApprovals: {
                                    orderBy: { createdAt: 'desc' },
                                    include: {
                                        reviewer: {
                                            select: { id: true, email: true, firstName: true, lastName: true },
                                        },
                                    },
                                },
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
     * Enrich a stage progress with action status information
     */
    enrichStageWithActionStatus(stage: any): any {
        // Compute action status based on stage state
        const isActive = stage.status === 'IN_PROGRESS';
        const isAwaitingTransition = stage.status === 'AWAITING_TRANSITION';
        const isCompleted = stage.status === 'COMPLETED';

        return {
            ...stage,
            actionStatus: {
                isActive,
                isAwaitingTransition,
                isCompleted,
                nextActor: isActive ? stage.reviewParty : null,
                actionRequired: isActive ? `${stage.reviewParty} review required` :
                    isAwaitingTransition ? 'Stage transition required' : null,
            },
        };
    }

    /**
     * Enrich a phase with action status information
     */
    enrichPhaseWithActionStatus(phase: any): any {
        // Enrich all stage progress with action status
        if (phase.documentationPhase?.stageProgress) {
            phase.documentationPhase.stageProgress = phase.documentationPhase.stageProgress.map(
                (stage: any) => this.enrichStageWithActionStatus(stage)
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

        // Determine current stage ID if applicable
        let stageId: string | undefined;
        if (phase.documentationPhase?.currentStageOrder) {
            const currentStage = phase.documentationPhase.stageProgress?.find(
                (sp: any) => sp.stageOrder === phase.documentationPhase.currentStageOrder
            );
            stageId = currentStage?.id;
        }

        await blockerService.createBlocker({
            tenantId,
            applicationId: phase.applicationId,
            phaseId: phase.id,
            stepId: stageId, // Using stageId in place of stepId for now
            nextActor: actionStatus.nextActor,
            actionCategory: actionStatus.actionCategory,
            actionRequired: actionStatus.actionRequired,
            metadata: {
                phaseName: phase.name,
                phaseType: phase.phaseType,
                phaseCategory: phase.phaseCategory,
                stageName: stageId ? this.getStageNameById(phase, stageId) : undefined,
            },
        });
    }

    /**
     * Resolve stage-level blockers when a stage action is completed
     */
    private async resolveStageBlockers(
        phase: any,
        stageId: string,
        trigger: string,
        userId: string
    ): Promise<void> {
        const tenantId = phase.application?.buyer?.tenantId || phase.tenantId;
        if (!tenantId) return;

        const blockerService = createWorkflowBlockerService(tenantId);
        await blockerService.resolveStepBlockers(phase.applicationId, stageId, {
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
     * Helper to get stage name by ID
     */
    private getStageNameById(phase: any, stageId: string): string | undefined {
        const stageProgress = phase.documentationPhase?.stageProgress || [];
        const stage = stageProgress.find((s: any) => s.id === stageId);
        return stage?.stageName;
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
            // Resolve existing blockers for the stage or phase
            if (stepId) {
                await this.resolveStageBlockers(phase, stepId, trigger, userId);
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
    async getPhasesByApplication(applicationId: string): Promise<any[]> {
        const phases = await prisma.applicationPhase.findMany({
            where: { applicationId },
            orderBy: { order: 'asc' },
            include: {
                questionnairePhase: true,
                documentationPhase: {
                    include: {
                        stageProgress: {
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

            // Initialize approval stage progress for DOCUMENTATION phases
            if (phase.documentationPhase) {
                const approvalStages = (phase.documentationPhase.approvalStagesSnapshot as ApprovalStageSnapshot[]) ||
                    phase.documentationPhase.documentationPlan?.approvalStages || [];

                if (approvalStages.length > 0) {
                    await approvalWorkflowService.initializeStageProgress(
                        tx,
                        phase.documentationPhase.id,
                        phase.application?.tenantId || phase.tenantId,
                        approvalStages
                    );
                }

                // Set current stage to 1
                await tx.documentationPhase.update({
                    where: { id: phase.documentationPhase.id },
                    data: { currentStageOrder: 1 },
                });
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

        // Get enriched phase with action status
        const enrichedPhase = await this.findByIdWithActionStatus(updated.id);

        return enrichedPhase;
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
     * Upload document for a documentation phase
     * 
     * New Stage-Based Logic:
     * - Documents are uploaded to the documentation phase (not tied to steps)
     * - Documents match against DocumentDefinition by type
     * - Documents enter the approval workflow for the current stage
     */
    async uploadDocument(phaseId: string, data: UploadDocumentInput, userId: string) {
        const phase = await this.findById(phaseId);

        if (!phase.documentationPhase) {
            throw new AppError(400, 'Can only upload documents to DOCUMENTATION phases');
        }

        // Use the approval workflow service to handle upload
        const result = await approvalWorkflowService.uploadDocument({
            tenantId: phase.application.tenantId,
            applicationId: phase.applicationId,
            documentationPhaseId: phase.documentationPhase.id,
            documentType: data.type || 'OTHER',
            documentName: data.name,
            fileName: data.name,
            fileUrl: data.url,
            uploadedById: userId,
        });

        // Return document with current phase action status
        const updatedPhase = await this.findByIdWithActionStatus(phaseId);

        return {
            document: result.document,
            phaseActionStatus: updatedPhase.actionStatus,
        };
    }

    /**
     * Review a document - approve, reject, or request changes
     * This is the new stage-based approval method
     */
    async reviewDocument(
        phaseId: string,
        documentId: string,
        decision: ReviewDecision,
        reviewerParty: ReviewParty,
        userId: string,
        comment?: string
    ): Promise<any> {
        const phase = await this.findById(phaseId);

        if (!phase.documentationPhase) {
            throw new AppError(400, 'Can only review documents in DOCUMENTATION phases');
        }

        // Use approval workflow service
        const result = await approvalWorkflowService.reviewDocument({
            tenantId: phase.application.tenantId,
            documentId,
            reviewerId: userId,
            reviewParty: reviewerParty,
            decision,
            comment,
        });

        // Check if we need to complete the phase
        if (result.stageCompleted) {
            const currentStage = await approvalWorkflowService.getCurrentStage(
                phase.documentationPhase.id
            );

            // If no more stages, complete the phase
            if (!currentStage) {
                await this.completeDocumentationPhase(phaseId, userId);
            }
        }

        // Send notifications based on decision
        if (decision === 'REJECTED' || decision === 'CHANGES_REQUESTED') {
            const buyer = phase.application?.buyer;
            const propertyName = phase.application?.propertyUnit?.variant?.property?.title;
            if (buyer?.email) {
                const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.qshelter.com';
                await sendDocumentRejectedNotification({
                    email: buyer.email,
                    userName: buyer.firstName || buyer.email,
                    documentName: result.document.name,
                    stepName: result.document.type || 'Document',
                    applicationNumber: phase.application?.applicationNumber || '',
                    propertyName,
                    reason: comment || 'No reason provided',
                    dashboardUrl: `${dashboardUrl}/applications/${phase.applicationId}`,
                }).catch((err) => {
                    console.error('[ApplicationPhaseService] Failed to send rejection notification', err);
                });
            }
        }

        return this.findByIdWithActionStatus(phaseId);
    }

    /**
     * Complete a documentation phase (all documents approved through all stages)
     */
    private async completeDocumentationPhase(phaseId: string, userId: string): Promise<void> {
        const phase = await this.findById(phaseId);

        await prisma.$transaction(async (tx) => {
            // Complete the phase
            await tx.applicationPhase.update({
                where: { id: phaseId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            // Clear currentStageOrder on DocumentationPhase
            if (phase.documentationPhase) {
                await tx.documentationPhase.update({
                    where: { id: phase.documentationPhase.id },
                    data: { currentStageOrder: undefined },
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
                    data: { status: 'IN_PROGRESS' },
                });

                await tx.application.update({
                    where: { id: phase.applicationId },
                    data: { currentPhaseId: nextPhase.id },
                });
            }

            // Handle unit locking if configured
            await this.handleUnitLockingOnPhaseComplete(tx, phaseId, userId);
        });

        // Send phase completion notification
        this.sendPhaseCompletionNotification(phaseId);
    }

    /**
     * Approve a document (legacy compatibility - delegates to reviewDocument)
     * @deprecated Use reviewDocument instead
     */
    async approveDocument(
        phaseId: string,
        documentId: string,
        userId: string,
        comment?: string
    ): Promise<any> {
        return this.reviewDocument(
            phaseId,
            documentId,
            'APPROVED',
            'INTERNAL', // Default to internal review
            userId,
            comment
        );
    }

    /**
     * Reject a document (legacy compatibility - delegates to reviewDocument)
     * @deprecated Use reviewDocument with REJECTED decision instead
     */
    async rejectDocument(
        phaseId: string,
        documentId: string,
        reason: string,
        userId: string
    ): Promise<any> {
        return this.reviewDocument(
            phaseId,
            documentId,
            'REJECTED',
            'INTERNAL',
            userId,
            reason
        );
    }

    /**
     * Get document checklist for a documentation phase
     */
    async getDocumentChecklist(phaseId: string): Promise<any[]> {
        const phase = await this.findById(phaseId);

        if (!phase.documentationPhase) {
            throw new AppError(400, 'Can only get checklist for DOCUMENTATION phases');
        }

        return approvalWorkflowService.getDocumentChecklist(
            phase.documentationPhase.id
        );
    }

    /**
     * @deprecated Steps have been replaced with stages. Use reviewDocument instead.
     */
    async rejectStep(
        _phaseId: string,
        _stepId: string,
        _reason: string,
        _userId: string
    ): Promise<any> {
        throw new AppError(400, 'rejectStep is deprecated. Use reviewDocument with REJECTED decision instead.');
    }

    /**
     * @deprecated Steps have been replaced with stages. Use reviewDocument instead.
     */
    async requestStepChanges(
        _phaseId: string,
        _stepId: string,
        _reason: string,
        _userId: string
    ): Promise<any> {
        throw new AppError(400, 'requestStepChanges is deprecated. Use reviewDocument with CHANGES_REQUESTED decision instead.');
    }

    /**
     * @deprecated Steps have been replaced with stages.
     */
    async performGateAction(
        _phaseId: string,
        _stepId: string,
        _data: { action: string; comment?: string },
        _userId: string,
        _userRoles: string[]
    ): Promise<any> {
        throw new AppError(400, 'performGateAction is deprecated. Gate steps have been replaced with approval stages.');
    }

    /**
     * @deprecated Steps have been replaced with stages. This method is no longer used.
     */
    async completeStep(_phaseId: string, _data: any, _userId: string): Promise<any> {
        throw new AppError(400, 'completeStep is deprecated. Use reviewDocument to approve documents.');
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
                        include: { stageProgress: true },
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
                    const stagesCount = phase.documentationPhase?.stageProgress?.length ?? 0;
                    await sendDocumentationPhaseCompletedNotification({
                        ...basePayload,
                        stepsCompleted: stagesCount, // Note: using stagesCount but keeping param name for API compatibility
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
     * Criteria: All stages are COMPLETED
     */
    private async evaluatePhaseCompletionInternal(tx: any, phaseId: string, userId: string) {
        const phase = await tx.applicationPhase.findUnique({
            where: { id: phaseId },
            include: {
                application: true,
                documentationPhase: {
                    include: { stageProgress: true },
                },
            },
        });

        if (!phase?.documentationPhase) return;
        if (phase.status === 'COMPLETED') return;

        const stageProgress = phase.documentationPhase.stageProgress || [];
        const incompleteStages = stageProgress.filter(
            (s: any) => s.status !== 'COMPLETED'
        );

        if (incompleteStages.length > 0) return;

        // All stages completed → complete phase and auto-activate next
        await tx.applicationPhase.update({
            where: { id: phaseId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        });

        // Clear currentStageOrder
        await tx.documentationPhase.update({
            where: { id: phase.documentationPhase.id },
            data: { currentStageOrder: undefined },
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
            include: {
                documentationPhase: true,
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

            // Run condition evaluation for DOCUMENTATION phases with sourceQuestionnairePhaseId
            // This marks inapplicable steps as SKIPPED based on questionnaire answers
            if (nextPhase.documentationPhase?.sourceQuestionnairePhaseId) {
                const conditionEvaluator = createConditionEvaluatorService(tx);
                const evaluationResult = await conditionEvaluator.applyConditionEvaluation(
                    nextPhase.documentationPhase.id
                );

                console.log(
                    `[Auto-activation] Condition evaluation for phase ${nextPhase.id}: ` +
                    `${evaluationResult.skippedCount} steps skipped, ` +
                    `${evaluationResult.applicableCount} steps applicable`
                );
            }

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
        } else {
            // No more phases - check if application should be completed
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

        // For DOCUMENTATION phases, check if all stages are completed
        if (phase.phaseCategory === 'DOCUMENTATION' && phase.documentationPhase) {
            const stageProgress = phase.documentationPhase.stageProgress || [];
            const incompleteStages = stageProgress.filter(
                (s: any) => s.status !== 'COMPLETED'
            );
            if (incompleteStages.length > 0) {
                throw new AppError(400, `${incompleteStages.length} stages still incomplete`);
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

            if (question?.scoringRules && Array.isArray(question.scoringRules)) {
                const rules = question.scoringRules as unknown as ScoringRule[];

                // First matching rule wins
                for (const rule of rules) {
                    if (rule.operator && rule.value !== undefined && rule.score !== undefined) {
                        let matches = false;
                        const ruleValue = rule.value;

                        // For numeric operators, convert to numbers
                        if (typeof ruleValue === 'number') {
                            const numericAnswer = Number(answer);
                            switch (rule.operator) {
                                case ConditionOperator.GREATER_THAN:
                                    matches = numericAnswer > ruleValue;
                                    break;
                                case ConditionOperator.GREATER_THAN_OR_EQUAL:
                                    matches = numericAnswer >= ruleValue;
                                    break;
                                case ConditionOperator.LESS_THAN:
                                    matches = numericAnswer < ruleValue;
                                    break;
                                case ConditionOperator.LESS_THAN_OR_EQUAL:
                                    matches = numericAnswer <= ruleValue;
                                    break;
                                case ConditionOperator.EQUALS:
                                    matches = numericAnswer === ruleValue;
                                    break;
                                case ConditionOperator.NOT_EQUALS:
                                    matches = numericAnswer !== ruleValue;
                                    break;
                            }
                        } else if (typeof ruleValue === 'boolean') {
                            // Boolean comparison
                            const boolAnswer = answer === true || answer === 'true' || answer === 1;
                            switch (rule.operator) {
                                case ConditionOperator.EQUALS:
                                    matches = boolAnswer === ruleValue;
                                    break;
                                case ConditionOperator.NOT_EQUALS:
                                    matches = boolAnswer !== ruleValue;
                                    break;
                            }
                        } else if (typeof ruleValue === 'string') {
                            // String comparison
                            const stringAnswer = String(answer);
                            switch (rule.operator) {
                                case ConditionOperator.EQUALS:
                                    matches = stringAnswer === ruleValue;
                                    break;
                                case ConditionOperator.NOT_EQUALS:
                                    matches = stringAnswer !== ruleValue;
                                    break;
                            }
                        }

                        if (matches) {
                            fieldScore = rule.score;
                            fieldPassed = rule.score > 0;
                            break; // First match wins
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

                // Auto-activate the next phase
                const nextPhase = await tx.applicationPhase.findFirst({
                    where: {
                        applicationId: phase.applicationId,
                        order: phase.order + 1,
                    },
                    include: {
                        documentationPhase: true,
                    },
                });

                if (nextPhase) {
                    await tx.applicationPhase.update({
                        where: { id: nextPhase.id },
                        data: {
                            status: 'IN_PROGRESS',
                            activatedAt: now,
                        },
                    });

                    await tx.application.update({
                        where: { id: phase.applicationId },
                        data: { currentPhaseId: nextPhase.id },
                    });

                    // Run condition evaluation for DOCUMENTATION phases with sourceQuestionnairePhaseId
                    // This marks inapplicable steps as SKIPPED based on questionnaire answers
                    if (nextPhase.documentationPhase?.sourceQuestionnairePhaseId) {
                        const conditionEvaluator = createConditionEvaluatorService(tx);
                        const evaluationResult = await conditionEvaluator.applyConditionEvaluation(
                            nextPhase.documentationPhase.id
                        );

                        console.log(
                            `[Questionnaire auto-complete] Condition evaluation for phase ${nextPhase.id}: ` +
                            `${evaluationResult.skippedCount} steps skipped, ` +
                            `${evaluationResult.applicableCount} steps applicable`
                        );
                    }

                    // Write PHASE.ACTIVATED event
                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            tenantId: phase.tenantId,
                            eventType: 'PHASE.ACTIVATED',
                            aggregateType: 'ApplicationPhase',
                            aggregateId: nextPhase.id,
                            queueName: 'application-steps',
                            payload: JSON.stringify({
                                phaseId: nextPhase.id,
                                applicationId: phase.applicationId,
                                phaseType: nextPhase.phaseType,
                                activatedBy: 'AUTO_QUESTIONNAIRE_COMPLETION',
                            }),
                            actorId: userId,
                        },
                    });
                }

                // Write PHASE.COMPLETED event
                await tx.domainEvent.create({
                    data: {
                        id: uuidv4(),
                        tenantId: phase.tenantId,
                        eventType: 'PHASE.COMPLETED',
                        aggregateType: 'ApplicationPhase',
                        aggregateId: phaseId,
                        queueName: 'application-steps',
                        payload: JSON.stringify({
                            phaseId,
                            applicationId: phase.applicationId,
                            phaseType: phase.phaseType,
                            completedBy: 'AUTO_QUESTIONNAIRE',
                        }),
                        actorId: userId,
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
