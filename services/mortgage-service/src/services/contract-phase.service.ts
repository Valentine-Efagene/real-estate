import { prisma } from '../lib/prisma';
import { AppError, PhaseStatus, StepStatus, InstallmentStatus, PaymentStatus, DocumentStatus } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    ActivatePhaseInput,
    CompleteStepInput,
    UploadDocumentInput,
    ApproveDocumentInput,
    GenerateInstallmentsInput,
} from '../validators/contract-phase.validator';
import { handleGenerateDocumentStep } from './step-handlers';
import { paymentPlanService } from './payment-plan.service';
import {
    sendDocumentApprovedNotification,
    sendDocumentRejectedNotification,
    formatDate,
} from '../lib/notifications';

class ContractPhaseService {
    async findById(phaseId: string): Promise<any> {
        const phase = await prisma.contractPhase.findUnique({
            where: { id: phaseId },
            include: {
                contract: {
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

    async getPhasesByContract(contractId: string): Promise<any[]> {
        const phases = await prisma.contractPhase.findMany({
            where: { contractId },
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
        return phases;
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
            const previousPhase = await prisma.contractPhase.findFirst({
                where: {
                    contractId: phase.contractId,
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
            const result = await tx.contractPhase.update({
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

            // Update contract's current phase
            await tx.contract.update({
                where: { id: phase.contractId },
                data: { currentPhaseId: phaseId },
            });

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'PHASE.ACTIVATED',
                    aggregateType: 'ContractPhase',
                    aggregateId: phaseId,
                    queueName: 'contract-steps',
                    payload: JSON.stringify({
                        phaseId,
                        contractId: phase.contractId,
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

        return this.findById(updated.id);
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
            console.info('[ContractPhaseService] Auto-executing GENERATE_DOCUMENT step', {
                stepId: nextStep.id,
                stepName: nextStep.name,
                phaseId,
            });

            try {
                await handleGenerateDocumentStep(
                    nextStep.id,
                    phaseId,
                    phase.contractId,
                    userId
                );

                // Recursively check for more auto-executable steps
                await this.processAutoExecutableSteps(phaseId, userId);
            } catch (error: any) {
                console.error('[ContractPhaseService] GENERATE_DOCUMENT step failed', {
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
        const numberOfInstallments = paymentPlan.numberOfInstallments;
        const intervalDays = paymentPlanService.getIntervalDays(paymentPlan);

        // Calculate installment amounts using amortization
        const installments = this.calculateInstallments(
            totalAmount,
            interestRate,
            numberOfInstallments,
            startDate,
            intervalDays,
            paymentPlan.gracePeriodDays
        );

        await prisma.$transaction(async (tx) => {
            // Create installments
            for (const installment of installments) {
                await tx.contractInstallment.create({
                    data: {
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

            // Update contract's next payment due date
            if (installments.length > 0) {
                await tx.contract.update({
                    where: { id: phase.contractId },
                    data: { nextPaymentDueDate: installments[0].dueDate },
                });
            }

            // Write domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'INSTALLMENTS.GENERATED',
                    aggregateType: 'ContractPhase',
                    aggregateId: phaseId,
                    queueName: 'contract-steps',
                    payload: JSON.stringify({
                        phaseId,
                        contractId: phase.contractId,
                        installmentCount: installments.length,
                        totalAmount,
                    }),
                    actorId: userId,
                },
            });
        });

        return this.findById(phaseId);
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
            if (phase.contract.buyerId === userId) {
                throw new AppError(403, 'This step requires admin approval');
            }
        }

        if (step.status === 'COMPLETED') {
            throw new AppError(400, 'Step already completed');
        }

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
                await tx.contractPhase.update({
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
                        eventType: 'PHASE.COMPLETED',
                        aggregateType: 'ContractPhase',
                        aggregateId: phaseId,
                        queueName: 'contract-steps',
                        payload: JSON.stringify({
                            phaseId,
                            contractId: phase.contractId,
                            phaseType: phase.phaseType,
                        }),
                        actorId: userId,
                    },
                });

                // Auto-activate next phase
                const nextPhase = await tx.contractPhase.findFirst({
                    where: {
                        contractId: phase.contractId,
                        order: phase.order + 1,
                    },
                });

                if (nextPhase) {
                    await tx.contractPhase.update({
                        where: { id: nextPhase.id },
                        data: {
                            status: 'IN_PROGRESS',
                        },
                    });

                    // Update contract's current phase
                    await tx.contract.update({
                        where: { id: phase.contractId },
                        data: { currentPhaseId: nextPhase.id },
                    });

                    // Write phase activated event
                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            eventType: 'PHASE.ACTIVATED',
                            aggregateType: 'ContractPhase',
                            aggregateId: nextPhase.id,
                            queueName: 'contract-steps',
                            payload: JSON.stringify({
                                phaseId: nextPhase.id,
                                contractId: phase.contractId,
                                phaseType: nextPhase.phaseType,
                            }),
                            actorId: userId,
                        },
                    });
                }
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
                    eventType: 'PHASE.STEP.COMPLETED',
                    aggregateType: 'DocumentationStep',
                    aggregateId: stepId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        stepId: stepId,
                        phaseId,
                        contractId: phase.contractId,
                        decision: data.decision,
                    }),
                    actorId: userId,
                },
            });
        });

        // After completing a step, check for auto-executable next steps
        await this.processAutoExecutableSteps(phaseId, userId);

        return this.findById(phaseId);
    }

    /**
     * Upload a document for a phase/step
     */
    async uploadDocument(phaseId: string, data: UploadDocumentInput, userId: string) {
        const phase = await this.findById(phaseId);

        const document = await prisma.contractDocument.create({
            data: {
                contractId: phase.contractId,
                phaseId,
                stepId: data.stepId,
                name: data.name,
                url: data.url,
                type: data.type,
                uploadedById: userId,
                status: 'PENDING',
            },
        });

        // If step is provided, update step status and track submission
        if (data.stepId) {
            const step = await prisma.documentationStep.findUnique({
                where: { id: data.stepId },
            });

            if (step) {
                // If step was in NEEDS_RESUBMISSION, move to AWAITING_REVIEW
                // Otherwise move to IN_PROGRESS
                const newStatus = step.status === 'NEEDS_RESUBMISSION' ? 'AWAITING_REVIEW' : 'IN_PROGRESS';

                await prisma.documentationStep.update({
                    where: { id: data.stepId },
                    data: {
                        status: newStatus,
                        submissionCount: { increment: 1 },
                        lastSubmittedAt: new Date(),
                        // Clear action reason when user resubmits
                        actionReason: step.status === 'NEEDS_RESUBMISSION' ? null : step.actionReason,
                    },
                });
            }
        }

        return document;
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
                    eventType: 'PHASE.STEP.REJECTED',
                    aggregateType: 'DocumentationStep',
                    aggregateId: stepId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        stepId,
                        phaseId,
                        contractId: phase.contractId,
                        reason,
                    }),
                    actorId: userId,
                },
            });
        });

        // Send rejection notification to the buyer
        const buyer = phase.contract?.buyer;
        const propertyName = phase.contract?.propertyUnit?.variant?.property?.title;
        if (buyer?.email) {
            const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.qshelter.com';
            await sendDocumentRejectedNotification({
                email: buyer.email,
                userName: buyer.firstName || buyer.email,
                documentName: step.name,
                stepName: step.name,
                contractNumber: phase.contract?.contractNumber || '',
                propertyName,
                reason: reason,
                dashboardUrl: `${dashboardUrl}/contracts/${phase.contractId}`,
            }).catch((err) => {
                console.error('[ContractPhaseService] Failed to send step rejected notification', err);
            });
        }

        return this.findById(phaseId);
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
                    eventType: 'PHASE.STEP.CHANGES_REQUESTED',
                    aggregateType: 'DocumentationStep',
                    aggregateId: stepId,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        stepId,
                        phaseId,
                        contractId: phase.contractId,
                        reason,
                    }),
                    actorId: userId,
                },
            });
        });

        return this.findById(phaseId);
    }

    /**
     * Approve or reject a document
     */
    async approveDocument(documentId: string, data: ApproveDocumentInput, userId: string) {
        // Get document with full context for notifications
        const document = await prisma.contractDocument.findUnique({
            where: { id: documentId },
            include: {
                contract: {
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

        const updated = await prisma.contractDocument.update({
            where: { id: documentId },
            data: {
                status: data.status,
            },
        });

        // If document is rejected and has a stepId, revert the step to NEEDS_RESUBMISSION
        if (data.status === 'REJECTED' && document.stepId) {
            await prisma.documentationStep.update({
                where: { id: document.stepId },
                data: {
                    status: 'NEEDS_RESUBMISSION',
                    actionReason: data.comment || 'Document was rejected. Please resubmit.',
                },
            });
        }

        // Send notification to the buyer
        const buyer = document.contract?.buyer;
        const propertyName = document.contract?.propertyUnit?.variant?.property?.title;
        if (buyer?.email) {
            const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.qshelter.com';

            if (data.status === 'APPROVED') {
                await sendDocumentApprovedNotification({
                    email: buyer.email,
                    userName: buyer.firstName || buyer.email,
                    documentName: document.name,
                    stepName,
                    contractNumber: document.contract?.contractNumber || '',
                    propertyName,
                    approvedDate: formatDate(new Date()),
                    dashboardUrl: `${dashboardUrl}/contracts/${document.contractId}`,
                }).catch((err) => {
                    console.error('[ContractPhaseService] Failed to send document approved notification', err);
                });
            } else if (data.status === 'REJECTED') {
                await sendDocumentRejectedNotification({
                    email: buyer.email,
                    userName: buyer.firstName || buyer.email,
                    documentName: document.name,
                    stepName,
                    contractNumber: document.contract?.contractNumber || '',
                    propertyName,
                    reason: data.comment || 'Please resubmit with the correct document.',
                    dashboardUrl: `${dashboardUrl}/contracts/${document.contractId}`,
                }).catch((err) => {
                    console.error('[ContractPhaseService] Failed to send document rejected notification', err);
                });
            }
        }

        return updated;
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
            const result = await tx.contractPhase.update({
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
            const incompletePhasesCount = await tx.contractPhase.count({
                where: {
                    contractId: phase.contractId,
                    status: { notIn: ['COMPLETED', 'SKIPPED'] },
                    id: { not: phaseId },
                },
            });

            if (incompletePhasesCount === 0) {
                // All phases completed - complete the contract
                await tx.contract.update({
                    where: { id: phase.contractId },
                    data: {
                        status: 'COMPLETED',
                    },
                });

                await tx.domainEvent.create({
                    data: {
                        id: uuidv4(),
                        eventType: 'CONTRACT.COMPLETED',
                        aggregateType: 'Contract',
                        aggregateId: phase.contractId,
                        queueName: 'notifications',
                        payload: JSON.stringify({ contractId: phase.contractId }),
                        actorId: userId,
                    },
                });
            }

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'PHASE.COMPLETED',
                    aggregateType: 'ContractPhase',
                    aggregateId: phaseId,
                    queueName: 'contract-steps',
                    payload: JSON.stringify({
                        phaseId,
                        contractId: phase.contractId,
                        phaseType: phase.phaseType,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        return this.findById(updated.id);
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
            const result = await tx.contractPhase.update({
                where: { id: phaseId },
                data: {
                    status: 'SKIPPED',
                    completedAt: new Date(),
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'PHASE.SKIPPED',
                    aggregateType: 'ContractPhase',
                    aggregateId: phaseId,
                    queueName: 'contract-steps',
                    payload: JSON.stringify({
                        phaseId,
                        contractId: phase.contractId,
                        reason,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        return this.findById(updated.id);
    }
}

export const contractPhaseService = new ContractPhaseService();
