import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    ConflictError,
    ValidationError,
    ForbiddenError,
    OnboardingStatus,
    PhaseStatus,
    ReviewDecision,
    PhaseCategory,
    Prisma,
} from '@valentine-efagene/qshelter-common';

// =============================================================================
// TYPES
// =============================================================================

export interface StartOnboardingInput {
    onboardingFlowId: string;
    assigneeId?: string;
}

export interface SubmitQuestionnaireFieldsInput {
    fields: Array<{
        fieldId: string;
        value: any;
    }>;
}

export interface ReviewGateInput {
    decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    notes?: string;
}

export interface ReassignOnboarderInput {
    newAssigneeId: string;
}

// =============================================================================
// ONBOARDING SERVICE
// =============================================================================
// Manages the full lifecycle of organization onboarding workflows.
// Mirrors the mortgage application pattern: template → instance → phase orchestration.
// =============================================================================

class OnboardingService {
    // =========================================================================
    // ONBOARDING CREATION & RETRIEVAL
    // =========================================================================

    /**
     * Create an onboarding workflow for an organization.
     * Materializes OnboardingPhases from OnboardingFlowPhase templates.
     * Called automatically when an org is created with a type that has onboardingFlowId.
     */
    async createOnboarding(
        tenantId: string,
        organizationId: string,
        onboardingFlowId: string,
        assigneeId?: string,
    ) {
        // Check for existing onboarding
        const existing = await prisma.organizationOnboarding.findUnique({
            where: { organizationId },
        });
        if (existing) {
            throw new ConflictError('Organization already has an onboarding workflow');
        }

        // Fetch the onboarding flow with all phases and their plans
        const flow = await prisma.onboardingFlow.findUnique({
            where: { id: onboardingFlowId },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        questionnairePlan: {
                            include: {
                                questions: { orderBy: { order: 'asc' } },
                            },
                        },
                        documentationPlan: {
                            include: {
                                documentDefinitions: { orderBy: { order: 'asc' } },
                                approvalStages: { orderBy: { order: 'asc' } },
                            },
                        },
                        gatePlan: true,
                    },
                },
            },
        });

        if (!flow) {
            throw new NotFoundError('Onboarding flow not found');
        }

        if (!flow.isActive) {
            throw new ValidationError('Onboarding flow is not active');
        }

        if (flow.phases.length === 0) {
            throw new ValidationError('Onboarding flow has no phases configured');
        }

        // Calculate expiry
        const expiresAt = flow.expiresInDays
            ? new Date(Date.now() + flow.expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        // Create everything in a transaction
        return prisma.$transaction(async (tx) => {
            // Create the onboarding record
            const onboarding = await tx.organizationOnboarding.create({
                data: {
                    tenantId,
                    organizationId,
                    onboardingFlowId,
                    assigneeId: assigneeId || null,
                    status: OnboardingStatus.PENDING,
                    expiresAt,
                    templateSnapshot: JSON.parse(JSON.stringify(flow)),
                },
            });

            // Track the most recent questionnaire phase for conditional linking
            let lastQuestionnairePhaseId: string | null = null;

            // Materialize phases from template
            for (const phaseTemplate of flow.phases) {
                const phase = await tx.onboardingPhase.create({
                    data: {
                        tenantId,
                        onboardingId: onboarding.id,
                        phaseTemplateId: phaseTemplate.id,
                        name: phaseTemplate.name,
                        description: phaseTemplate.description,
                        phaseCategory: phaseTemplate.phaseCategory,
                        order: phaseTemplate.order,
                        status: PhaseStatus.PENDING,
                        requiresPreviousPhaseCompletion: phaseTemplate.requiresPreviousPhaseCompletion,
                    },
                });

                // Create extension records based on phaseCategory
                if (phaseTemplate.phaseCategory === 'QUESTIONNAIRE') {
                    const plan = phaseTemplate.questionnairePlan;
                    const questions = plan?.questions || [];

                    const questionnairePhase = await tx.questionnairePhase.create({
                        data: {
                            tenantId,
                            onboardingPhaseId: phase.id,
                            questionnairePlanId: phaseTemplate.questionnairePlanId,
                            totalFieldsCount: questions.length,
                            completedFieldsCount: 0,
                            passingScore: plan?.passingScore,
                            fieldsSnapshot: plan ? {
                                questions: questions.map((q: any) => ({
                                    questionKey: q.questionKey,
                                    questionText: q.questionText,
                                    helpText: q.helpText,
                                    questionType: q.questionType,
                                    order: q.order,
                                    isRequired: q.isRequired,
                                    validationRules: q.validationRules,
                                    options: q.options,
                                    scoreWeight: q.scoreWeight,
                                    scoringRules: q.scoringRules,
                                    showIf: q.showIf,
                                    category: q.category,
                                })),
                            } : Prisma.DbNull,
                        },
                    });

                    lastQuestionnairePhaseId = questionnairePhase.id;

                    // Create QuestionnaireField records
                    for (const question of questions) {
                        await tx.questionnaireField.create({
                            data: {
                                tenantId,
                                questionnairePhaseId: questionnairePhase.id,
                                name: question.questionKey,
                                fieldType: question.questionType as any,
                                label: question.questionText,
                                description: question.helpText,
                                order: question.order,
                                isRequired: question.isRequired ?? true,
                                validation: question.validationRules ?? undefined,
                                defaultValue: question.options ? { options: question.options } : undefined,
                            },
                        });
                    }
                } else if (phaseTemplate.phaseCategory === 'DOCUMENTATION') {
                    const plan = phaseTemplate.documentationPlan;
                    const documentDefinitions = plan?.documentDefinitions || [];
                    const approvalStages = plan?.approvalStages || [];
                    const requiredDocsCount = documentDefinitions.filter((d: any) => d.isRequired).length;

                    const documentationPhase = await tx.documentationPhase.create({
                        data: {
                            tenantId,
                            onboardingPhaseId: phase.id,
                            documentationPlanId: phaseTemplate.documentationPlanId,
                            sourceQuestionnairePhaseId: lastQuestionnairePhaseId,
                            currentStageOrder: 1,
                            requiredDocumentsCount: requiredDocsCount,
                            approvedDocumentsCount: 0,
                            documentDefinitionsSnapshot: documentDefinitions.length > 0
                                ? documentDefinitions.map((d: any) => ({
                                    documentType: d.documentType,
                                    documentName: d.documentName,
                                    uploadedBy: d.uploadedBy,
                                    autoApprove: d.autoApprove ?? false,
                                    order: d.order,
                                    isRequired: d.isRequired,
                                    description: d.description,
                                    maxSizeBytes: d.maxSizeBytes,
                                    allowedMimeTypes: d.allowedMimeTypes,
                                    expiryDays: d.expiryDays,
                                    minFiles: d.minFiles,
                                    maxFiles: d.maxFiles,
                                    condition: d.condition,
                                }))
                                : Prisma.DbNull,
                            approvalStagesSnapshot: approvalStages.length > 0
                                ? approvalStages.map((s: any) => ({
                                    id: s.id,
                                    name: s.name,
                                    order: s.order,
                                    organizationTypeId: s.organizationTypeId,
                                    autoTransition: s.autoTransition,
                                    waitForAllDocuments: s.waitForAllDocuments,
                                    allowEarlyVisibility: s.allowEarlyVisibility,
                                    onRejection: s.onRejection,
                                    restartFromStageOrder: s.restartFromStageOrder,
                                    slaHours: s.slaHours,
                                    description: s.description,
                                }))
                                : Prisma.DbNull,
                        },
                    });

                    // Create ApprovalStageProgress records
                    for (const stage of approvalStages) {
                        await tx.approvalStageProgress.create({
                            data: {
                                tenantId,
                                documentationPhaseId: documentationPhase.id,
                                approvalStageId: stage.id,
                                name: stage.name,
                                order: stage.order,
                                organizationTypeId: stage.organizationTypeId,
                                autoTransition: stage.autoTransition ?? false,
                                waitForAllDocuments: stage.waitForAllDocuments ?? true,
                                allowEarlyVisibility: stage.allowEarlyVisibility ?? false,
                                onRejection: stage.onRejection || 'CASCADE_BACK',
                                restartFromStageOrder: stage.restartFromStageOrder,
                                status: stage.order === 1 ? 'IN_PROGRESS' : 'PENDING',
                                activatedAt: stage.order === 1 ? new Date() : null,
                            },
                        });
                    }
                } else if (phaseTemplate.phaseCategory === 'GATE') {
                    const plan = phaseTemplate.gatePlan;

                    await tx.gatePhase.create({
                        data: {
                            tenantId,
                            onboardingPhaseId: phase.id,
                            gatePlanId: phaseTemplate.gatePlanId,
                            requiredApprovals: plan?.requiredApprovals ?? 1,
                            reviewerOrganizationTypeId: plan!.reviewerOrganizationTypeId,
                            reviewerInstructions: plan?.reviewerInstructions,
                            gatePlanSnapshot: plan ? JSON.parse(JSON.stringify(plan)) : null,
                        },
                    });
                }
            }

            // If assignee is provided, auto-start the onboarding
            if (assigneeId) {
                return this.startOnboardingInternal(tx, onboarding.id, tenantId);
            }

            return this.fetchOnboarding(onboarding.id);
        }, { timeout: 30000 });
    }

    /**
     * Start the onboarding (activate first phase). Called when assignee is set.
     */
    async startOnboarding(tenantId: string, organizationId: string, userId: string) {
        const onboarding = await prisma.organizationOnboarding.findFirst({
            where: { organizationId, tenantId },
        });

        if (!onboarding) {
            throw new NotFoundError('Onboarding not found for this organization');
        }

        if (onboarding.status !== OnboardingStatus.PENDING) {
            throw new ValidationError(`Cannot start onboarding with status: ${onboarding.status}`);
        }

        if (!onboarding.assigneeId) {
            throw new ValidationError('Onboarding requires an assignee before it can start');
        }

        return prisma.$transaction(async (tx) => {
            return this.startOnboardingInternal(tx, onboarding.id, tenantId);
        });
    }

    /**
     * Internal method to start onboarding (reused in create + start).
     */
    private async startOnboardingInternal(tx: any, onboardingId: string, tenantId: string) {
        // Activate first phase
        const firstPhase = await tx.onboardingPhase.findFirst({
            where: { onboardingId },
            orderBy: { order: 'asc' },
        });

        if (!firstPhase) {
            throw new ValidationError('No phases found for this onboarding');
        }

        await tx.onboardingPhase.update({
            where: { id: firstPhase.id },
            data: {
                status: PhaseStatus.IN_PROGRESS,
                activatedAt: new Date(),
            },
        });

        // Update onboarding status
        await tx.organizationOnboarding.update({
            where: { id: onboardingId },
            data: {
                status: OnboardingStatus.IN_PROGRESS,
                startedAt: new Date(),
                currentPhaseId: firstPhase.id,
            },
        });

        return this.fetchOnboarding(onboardingId, tx);
    }

    /**
     * Get the full onboarding for an organization, with all phases and extensions.
     */
    async getOnboarding(tenantId: string, organizationId: string) {
        const onboarding = await prisma.organizationOnboarding.findFirst({
            where: { organizationId, tenantId },
            include: this.fullOnboardingInclude(),
        });

        if (!onboarding) {
            throw new NotFoundError('Onboarding not found for this organization');
        }

        return onboarding;
    }

    // =========================================================================
    // QUESTIONNAIRE PHASE OPERATIONS
    // =========================================================================

    /**
     * Submit questionnaire field values for an onboarding phase.
     */
    async submitQuestionnaireFields(
        tenantId: string,
        organizationId: string,
        phaseId: string,
        input: SubmitQuestionnaireFieldsInput,
    ) {
        const phase = await this.getAndValidatePhase(tenantId, organizationId, phaseId, 'QUESTIONNAIRE');

        const questionnairePhase = await prisma.questionnairePhase.findFirst({
            where: { onboardingPhaseId: phaseId },
            include: { fields: true },
        });

        if (!questionnairePhase) {
            throw new NotFoundError('Questionnaire phase extension not found');
        }

        // Validate and update fields
        return prisma.$transaction(async (tx) => {
            let updatedCount = 0;
            for (const { fieldId, value } of input.fields) {
                const field = questionnairePhase.fields.find((f) => f.id === fieldId);
                if (!field) {
                    throw new ValidationError(`Field ${fieldId} not found in this questionnaire`);
                }

                await tx.questionnaireField.update({
                    where: { id: fieldId },
                    data: {
                        answer: typeof value === 'string' ? value : JSON.stringify(value),
                        isValid: true,
                        submittedAt: new Date(),
                    },
                });
                updatedCount++;
            }

            // Update completed count
            const allFields = await tx.questionnaireField.findMany({
                where: { questionnairePhaseId: questionnairePhase.id },
            });
            const completedCount = allFields.filter((f) => f.answer !== null).length;

            await tx.questionnairePhase.update({
                where: { id: questionnairePhase.id },
                data: { completedFieldsCount: completedCount },
            });

            // Auto-complete if all required fields are filled
            const requiredFields = allFields.filter((f) => f.isRequired);
            const allRequiredFilled = requiredFields.every((f) => f.answer !== null);

            if (allRequiredFilled && requiredFields.length > 0) {
                return this.completePhaseAndActivateNext(tx, phaseId, tenantId);
            }

            return this.fetchOnboarding(
                (await tx.onboardingPhase.findUnique({ where: { id: phaseId } }))!.onboardingId,
                tx,
            );
        });
    }

    // =========================================================================
    // GATE PHASE OPERATIONS
    // =========================================================================

    /**
     * Review a gate phase (approve/reject the onboarding gate).
     */
    async reviewGatePhase(
        tenantId: string,
        organizationId: string,
        phaseId: string,
        reviewerId: string,
        input: ReviewGateInput,
    ) {
        const phase = await this.getAndValidatePhase(tenantId, organizationId, phaseId, 'GATE');

        const gatePhase = await prisma.gatePhase.findFirst({
            where: { onboardingPhaseId: phaseId },
            include: { reviews: true },
        });

        if (!gatePhase) {
            throw new NotFoundError('Gate phase extension not found');
        }

        // Check reviewer hasn't already reviewed
        const existingReview = gatePhase.reviews.find((r) => r.reviewerId === reviewerId);
        if (existingReview) {
            throw new ConflictError('You have already reviewed this gate');
        }

        return prisma.$transaction(async (tx) => {
            // Record the review
            await tx.gatePhaseReview.create({
                data: {
                    tenantId,
                    gatePhaseId: gatePhase.id,
                    reviewerId,
                    decision: input.decision as ReviewDecision,
                    notes: input.notes,
                },
            });

            if (input.decision === 'APPROVED') {
                const newApprovalCount = gatePhase.approvalCount + 1;

                await tx.gatePhase.update({
                    where: { id: gatePhase.id },
                    data: { approvalCount: newApprovalCount },
                });

                // Check if required approvals met
                if (newApprovalCount >= gatePhase.requiredApprovals) {
                    // Complete this phase and activate next (or complete onboarding)
                    return this.completePhaseAndActivateNext(tx, phaseId, tenantId, reviewerId);
                }
            } else if (input.decision === 'REJECTED') {
                await tx.gatePhase.update({
                    where: { id: gatePhase.id },
                    data: {
                        rejectionCount: gatePhase.rejectionCount + 1,
                        rejectionReason: input.notes,
                    },
                });

                // Reject the entire onboarding
                const onboardingPhase = await tx.onboardingPhase.findUnique({
                    where: { id: phaseId },
                });

                await tx.organizationOnboarding.update({
                    where: { id: onboardingPhase!.onboardingId },
                    data: {
                        status: OnboardingStatus.REJECTED,
                        rejectionReason: input.notes,
                    },
                });

                // Update org status
                const onboarding = await tx.organizationOnboarding.findUnique({
                    where: { id: onboardingPhase!.onboardingId },
                });
                await tx.organization.update({
                    where: { id: onboarding!.organizationId },
                    data: { status: 'INACTIVE' },
                });
            }

            const onboardingPhase = await tx.onboardingPhase.findUnique({ where: { id: phaseId } });
            return this.fetchOnboarding(onboardingPhase!.onboardingId, tx);
        });
    }

    // =========================================================================
    // DOCUMENTATION PHASE — Document Upload
    // =========================================================================

    /**
     * Upload a document for an onboarding documentation phase.
     * Documents are auto-approved on upload — the onboarder is the trusted uploader.
     * Tracks uploads in the documentDefinitionsSnapshot JSON and increments approvedDocumentsCount.
     * Auto-completes the phase when all required documents have been uploaded.
     */
    async uploadOnboardingDocument(
        tenantId: string,
        organizationId: string,
        phaseId: string,
        data: { documentType: string; url: string; fileName: string },
        userId: string,
    ) {
        const phase = await prisma.onboardingPhase.findFirst({
            where: {
                id: phaseId,
                tenantId,
                onboarding: { organizationId, tenantId },
            },
            include: {
                onboarding: true,
                documentationPhase: {
                    include: { stageProgress: true },
                },
            },
        });

        if (!phase) {
            throw new NotFoundError('Phase not found');
        }
        if (phase.phaseCategory !== 'DOCUMENTATION') {
            throw new ValidationError('Not a documentation phase');
        }
        if (phase.status !== PhaseStatus.IN_PROGRESS) {
            throw new ValidationError(`Phase is not active (status: ${phase.status})`);
        }
        if (!phase.documentationPhase) {
            throw new ValidationError('Documentation phase data is missing');
        }

        const dp = phase.documentationPhase;
        const snapshot = Array.isArray(dp.documentDefinitionsSnapshot)
            ? [...(dp.documentDefinitionsSnapshot as any[])]
            : [];

        // Find matching document definition in the snapshot
        const docIndex = snapshot.findIndex((d: any) => d.documentType === data.documentType);
        if (docIndex === -1) {
            const validTypes = snapshot.map((d: any) => d.documentType).join(', ');
            throw new ValidationError(
                `Document type "${data.documentType}" not found in this phase. Valid types: ${validTypes}`,
            );
        }

        const docDef = snapshot[docIndex];
        if (docDef.uploadedAt) {
            throw new ValidationError(
                `Document "${data.documentType}" has already been uploaded. ` +
                `Uploaded at ${docDef.uploadedAt}.`,
            );
        }

        // Mark as uploaded in the snapshot
        snapshot[docIndex] = {
            ...docDef,
            uploadedUrl: data.url,
            uploadedFileName: data.fileName,
            uploadedAt: new Date().toISOString(),
            uploadedById: userId,
        };

        // Count required docs that have been uploaded
        const newApprovedCount = snapshot.filter(
            (d: any) => d.uploadedAt && d.isRequired,
        ).length;

        return prisma.$transaction(async (tx) => {
            await tx.documentationPhase.update({
                where: { id: dp.id },
                data: {
                    documentDefinitionsSnapshot: snapshot,
                    approvedDocumentsCount: newApprovedCount,
                },
            });

            // If all required docs uploaded, complete stage progress and phase
            if (newApprovedCount >= dp.requiredDocumentsCount) {
                for (const stage of dp.stageProgress) {
                    if (stage.status !== 'COMPLETED') {
                        await tx.approvalStageProgress.update({
                            where: { id: stage.id },
                            data: { status: 'COMPLETED', completedAt: new Date() },
                        });
                    }
                }
                return this.completePhaseAndActivateNext(tx, phaseId, tenantId, userId);
            }

            return this.fetchOnboarding(phase.onboardingId, tx);
        });
    }

    // =========================================================================
    // ONBOARDER MANAGEMENT
    // =========================================================================

    /**
     * Assign or reassign the onboarding to a different user.
     */
    async reassignOnboarder(
        tenantId: string,
        organizationId: string,
        newAssigneeId: string,
        reassignedById: string,
    ) {
        const onboarding = await prisma.organizationOnboarding.findFirst({
            where: { organizationId, tenantId },
        });

        if (!onboarding) {
            throw new NotFoundError('Onboarding not found');
        }

        if (onboarding.status === OnboardingStatus.COMPLETED || onboarding.status === OnboardingStatus.REJECTED) {
            throw new ValidationError(`Cannot reassign a ${onboarding.status.toLowerCase()} onboarding`);
        }

        // Verify new assignee exists and is a member of the org
        const member = await prisma.organizationMember.findFirst({
            where: {
                organizationId,
                userId: newAssigneeId,
                isActive: true,
            },
        });

        if (!member) {
            throw new ValidationError('New assignee must be an active member of the organization');
        }

        const wasStarted = onboarding.status !== OnboardingStatus.PENDING;

        return prisma.$transaction(async (tx) => {
            await tx.organizationOnboarding.update({
                where: { id: onboarding.id },
                data: { assigneeId: newAssigneeId },
            });

            // If onboarding was PENDING and now has an assignee, auto-start it
            if (!wasStarted) {
                return this.startOnboardingInternal(tx, onboarding.id, tenantId);
            }

            return this.fetchOnboarding(onboarding.id, tx);
        });
    }

    /**
     * Set the onboarder (assignee) for an organization's onboarding.
     * Called when an invitation with isOnboarder=true is accepted.
     */
    async setOnboarder(tenantId: string, organizationId: string, assigneeId: string) {
        const onboarding = await prisma.organizationOnboarding.findFirst({
            where: { organizationId, tenantId },
        });

        if (!onboarding) {
            // No onboarding exists — org type may not require it
            return null;
        }

        if (onboarding.status !== OnboardingStatus.PENDING) {
            console.log(`[OnboardingService] Onboarding already started, skipping assignee set`);
            return null;
        }

        return prisma.$transaction(async (tx) => {
            await tx.organizationOnboarding.update({
                where: { id: onboarding.id },
                data: { assigneeId },
            });

            // Auto-start the onboarding
            return this.startOnboardingInternal(tx, onboarding.id, tenantId);
        });
    }

    // =========================================================================
    // PHASE ORCHESTRATION
    // =========================================================================

    /**
     * Complete the current phase and activate the next one.
     * If this is the final phase, complete the onboarding and activate the org.
     */
    private async completePhaseAndActivateNext(
        tx: any,
        phaseId: string,
        tenantId: string,
        userId?: string,
    ) {
        const phase = await tx.onboardingPhase.findUnique({
            where: { id: phaseId },
            include: { onboarding: true },
        });

        if (!phase) {
            throw new NotFoundError('Phase not found');
        }

        // Mark current phase as completed
        await tx.onboardingPhase.update({
            where: { id: phaseId },
            data: {
                status: PhaseStatus.COMPLETED,
                completedAt: new Date(),
            },
        });

        // Find next phase
        const nextPhase = await tx.onboardingPhase.findFirst({
            where: {
                onboardingId: phase.onboardingId,
                order: phase.order + 1,
            },
        });

        if (nextPhase) {
            // Activate next phase
            await tx.onboardingPhase.update({
                where: { id: nextPhase.id },
                data: {
                    status: PhaseStatus.IN_PROGRESS,
                    activatedAt: new Date(),
                },
            });

            // Update current phase pointer
            await tx.organizationOnboarding.update({
                where: { id: phase.onboardingId },
                data: { currentPhaseId: nextPhase.id },
            });

            console.log('[OnboardingService] Activated next phase', {
                completedPhaseId: phaseId,
                nextPhaseId: nextPhase.id,
                nextPhaseName: nextPhase.name,
            });
        } else {
            // Final phase completed — complete the onboarding and activate the org
            await tx.organizationOnboarding.update({
                where: { id: phase.onboardingId },
                data: {
                    status: OnboardingStatus.COMPLETED,
                    completedAt: new Date(),
                    approvedAt: new Date(),
                    approvedById: userId || null,
                    currentPhaseId: null,
                },
            });

            // Activate the organization!
            await tx.organization.update({
                where: { id: phase.onboarding.organizationId },
                data: { status: 'ACTIVE' },
            });

            console.log('[OnboardingService] Onboarding completed, organization activated', {
                onboardingId: phase.onboardingId,
                organizationId: phase.onboarding.organizationId,
            });
        }

        return this.fetchOnboarding(phase.onboardingId, tx);
    }

    // =========================================================================
    // CURRENT ACTION
    // =========================================================================

    /**
     * Get a structured summary of what's happening in the onboarding,
     * who needs to act, and what the current blocker is.
     * Designed to be a diagnostic/shareable snapshot (like current-step for applications).
     */
    async getCurrentAction(tenantId: string, organizationId: string, userId: string) {
        const onboarding = await prisma.organizationOnboarding.findFirst({
            where: { organizationId, tenantId },
            include: {
                organization: {
                    select: { id: true, name: true, status: true },
                },
                assignee: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
                approvedBy: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
                onboardingFlow: {
                    select: { id: true, name: true },
                },
                currentPhase: {
                    select: { id: true, name: true, phaseCategory: true, order: true, status: true },
                },
                phases: {
                    orderBy: { order: 'asc' as const },
                    include: {
                        questionnairePhase: {
                            include: {
                                fields: {
                                    orderBy: { order: 'asc' as const },
                                    select: {
                                        id: true,
                                        name: true,
                                        label: true,
                                        fieldType: true,
                                        isRequired: true,
                                        answer: true,
                                        submittedAt: true,
                                    },
                                },
                            },
                        },
                        documentationPhase: {
                            include: {
                                stageProgress: { orderBy: { order: 'asc' as const } },
                            },
                        },
                        gatePhase: {
                            include: {
                                reviews: {
                                    include: {
                                        reviewer: {
                                            select: { id: true, firstName: true, lastName: true, email: true },
                                        },
                                    },
                                    orderBy: { createdAt: 'desc' as const },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!onboarding) {
            throw new NotFoundError('Onboarding not found for this organization');
        }

        const isAssignee = userId === onboarding.assigneeId;
        const sortedPhases = [...onboarding.phases].sort((a, b) => a.order - b.order);
        const totalPhases = sortedPhases.length;
        const completedPhases = sortedPhases.filter((p) => p.status === 'COMPLETED').length;

        // Build phase summaries
        const phaseSummaries = sortedPhases.map((phase) => {
            const summary: any = {
                id: phase.id,
                name: phase.name,
                order: phase.order,
                phaseCategory: phase.phaseCategory,
                status: phase.status,
                activatedAt: phase.activatedAt,
                completedAt: phase.completedAt,
                isCurrent: onboarding.currentPhaseId === phase.id,
            };

            if (phase.phaseCategory === 'QUESTIONNAIRE' && phase.questionnairePhase) {
                const qp = phase.questionnairePhase;
                const allFields = qp.fields;
                const requiredFields = allFields.filter((f) => f.isRequired);
                const answeredFields = allFields.filter((f) => f.answer !== null);
                const unansweredRequired = requiredFields.filter((f) => f.answer === null);

                summary.questionnaire = {
                    totalFields: allFields.length,
                    answeredFields: answeredFields.length,
                    requiredFields: requiredFields.length,
                    unansweredRequiredFields: unansweredRequired.length,
                    isComplete: unansweredRequired.length === 0 && requiredFields.length > 0,
                    unansweredRequired: unansweredRequired.map((f) => ({
                        id: f.id,
                        name: f.name,
                        label: f.label,
                        fieldType: f.fieldType,
                    })),
                };
            }

            if (phase.phaseCategory === 'DOCUMENTATION' && phase.documentationPhase) {
                const dp = phase.documentationPhase;
                // Parse snapshot to list what specific documents are needed
                let docDefs: Array<{ documentType: string; documentName: string; isRequired: boolean; uploadedBy: string }> = [];
                if (dp.documentDefinitionsSnapshot && typeof dp.documentDefinitionsSnapshot === 'object') {
                    docDefs = Array.isArray(dp.documentDefinitionsSnapshot)
                        ? dp.documentDefinitionsSnapshot as any[]
                        : [];
                }

                summary.documentation = {
                    requiredDocumentsCount: dp.requiredDocumentsCount,
                    approvedDocumentsCount: dp.approvedDocumentsCount,
                    pendingUploadCount: dp.requiredDocumentsCount - dp.approvedDocumentsCount,
                    currentStageOrder: dp.currentStageOrder,
                    stages: dp.stageProgress.map((s) => ({
                        name: s.name,
                        order: s.order,
                        status: s.status,
                    })),
                    requiredDocuments: docDefs
                        .filter((d) => d.isRequired)
                        .map((d) => ({
                            documentType: d.documentType,
                            documentName: d.documentName,
                            uploadedBy: d.uploadedBy,
                        })),
                };
            }

            if (phase.phaseCategory === 'GATE' && phase.gatePhase) {
                const gp = phase.gatePhase;
                summary.gate = {
                    requiredApprovals: gp.requiredApprovals,
                    approvalCount: gp.approvalCount,
                    rejectionCount: gp.rejectionCount,
                    rejectionReason: gp.rejectionReason,
                    reviewerInstructions: gp.reviewerInstructions,
                    reviews: gp.reviews.map((r) => ({
                        reviewer: {
                            id: r.reviewer.id,
                            name: [r.reviewer.firstName, r.reviewer.lastName].filter(Boolean).join(' ') || r.reviewer.email,
                        },
                        decision: r.decision,
                        notes: r.notes,
                        createdAt: r.createdAt,
                    })),
                };
            }

            return summary;
        });

        // Determine action required
        let actionRequired: string = 'NONE';
        let actionMessage = 'No action required.';
        let actionBy: string = 'NONE'; // WHO needs to act: 'ASSIGNEE', 'ADMIN', 'NONE'
        let blockerDetails: any = null;

        const currentPhase = onboarding.currentPhase
            ? sortedPhases.find((p) => p.id === onboarding.currentPhaseId)
            : null;

        if (onboarding.status === 'COMPLETED') {
            actionRequired = 'COMPLETE';
            actionMessage = 'Onboarding is complete. Organization is active.';
            actionBy = 'NONE';
        } else if (onboarding.status === 'REJECTED') {
            actionRequired = 'REJECTED';
            actionMessage = `Onboarding was rejected. ${onboarding.rejectionReason || ''}`.trim();
            actionBy = 'NONE';
        } else if (onboarding.status === 'EXPIRED') {
            actionRequired = 'EXPIRED';
            actionMessage = 'Onboarding has expired.';
            actionBy = 'NONE';
        } else if (onboarding.status === 'PENDING') {
            if (!onboarding.assigneeId) {
                actionRequired = 'ASSIGN_STAFF';
                actionMessage = 'An admin needs to assign a staff member to run the onboarding.';
                actionBy = 'ADMIN';
            } else {
                actionRequired = 'START';
                actionMessage = 'Onboarding has an assignee but has not been started yet.';
                actionBy = 'ADMIN';
            }
        } else if (currentPhase) {
            // IN_PROGRESS — determine action from current phase
            if (currentPhase.phaseCategory === 'QUESTIONNAIRE' && currentPhase.questionnairePhase) {
                const qp = currentPhase.questionnairePhase;
                const requiredFields = qp.fields.filter((f) => f.isRequired);
                const unansweredRequired = requiredFields.filter((f) => f.answer === null);

                if (unansweredRequired.length > 0) {
                    actionRequired = 'QUESTIONNAIRE';
                    actionMessage = `${unansweredRequired.length} of ${requiredFields.length} required fields still need answers in "${currentPhase.name}".`;
                    actionBy = 'ASSIGNEE';
                    blockerDetails = {
                        unansweredFieldCount: unansweredRequired.length,
                        unansweredFields: unansweredRequired.map((f) => ({
                            id: f.id,
                            name: f.name,
                            label: f.label,
                        })),
                    };
                } else {
                    // All required fields filled but phase not yet completed — shouldn't happen normally
                    actionRequired = 'QUESTIONNAIRE_COMPLETE';
                    actionMessage = `All required fields are filled in "${currentPhase.name}" but the phase has not advanced. This may indicate a bug.`;
                    actionBy = 'SYSTEM';
                }
            } else if (currentPhase.phaseCategory === 'DOCUMENTATION' && currentPhase.documentationPhase) {
                const dp = currentPhase.documentationPhase;
                const pendingUploadCount = dp.requiredDocumentsCount - dp.approvedDocumentsCount;
                const allUploaded = dp.approvedDocumentsCount >= dp.requiredDocumentsCount;

                // Parse snapshot to list what specific documents are needed
                let documentDefinitions: Array<{ documentType: string; documentName: string; isRequired: boolean; uploadedBy: string }> = [];
                if (dp.documentDefinitionsSnapshot && typeof dp.documentDefinitionsSnapshot === 'object') {
                    documentDefinitions = Array.isArray(dp.documentDefinitionsSnapshot)
                        ? dp.documentDefinitionsSnapshot as any[]
                        : [];
                }

                actionRequired = 'DOCUMENTATION';
                actionBy = 'ASSIGNEE';

                if (dp.approvedDocumentsCount === 0) {
                    // No docs submitted yet — upload is the blocker, not review
                    actionMessage = `${dp.requiredDocumentsCount} required document(s) must be uploaded for "${currentPhase.name}". No documents have been submitted yet.`;
                } else if (!allUploaded) {
                    // Some uploaded/approved but not all
                    actionMessage = `${dp.approvedDocumentsCount}/${dp.requiredDocumentsCount} documents approved for "${currentPhase.name}". ${pendingUploadCount} more needed.`;
                } else {
                    actionMessage = `All ${dp.requiredDocumentsCount} documents approved for "${currentPhase.name}". Phase should advance automatically.`;
                    actionBy = 'SYSTEM';
                }

                blockerDetails = {
                    requiredDocumentsCount: dp.requiredDocumentsCount,
                    approvedDocumentsCount: dp.approvedDocumentsCount,
                    pendingUploadCount,
                    pendingAction: dp.approvedDocumentsCount === 0 ? 'UPLOAD_DOCUMENTS' : allUploaded ? 'AWAITING_ADVANCEMENT' : 'UPLOAD_AND_REVIEW',
                    currentStageOrder: dp.currentStageOrder,
                    stages: dp.stageProgress.map((s) => ({
                        name: s.name,
                        order: s.order,
                        status: s.status,
                    })),
                    requiredDocuments: documentDefinitions
                        .filter((d) => d.isRequired)
                        .map((d) => ({
                            documentType: d.documentType,
                            documentName: d.documentName,
                            uploadedBy: d.uploadedBy,
                        })),
                };
            } else if (currentPhase.phaseCategory === 'GATE' && currentPhase.gatePhase) {
                const gp = currentPhase.gatePhase;
                const remaining = gp.requiredApprovals - gp.approvalCount;

                actionRequired = 'GATE_REVIEW';
                actionMessage = `Gate "${currentPhase.name}" needs admin review. ${gp.approvalCount}/${gp.requiredApprovals} approvals received (${remaining} more needed).`;
                actionBy = 'ADMIN';
                blockerDetails = {
                    requiredApprovals: gp.requiredApprovals,
                    currentApprovals: gp.approvalCount,
                    remainingApprovals: remaining,
                    rejectionCount: gp.rejectionCount,
                    reviews: gp.reviews.map((r) => ({
                        reviewerName: [r.reviewer.firstName, r.reviewer.lastName].filter(Boolean).join(' ') || r.reviewer.email,
                        decision: r.decision,
                        notes: r.notes,
                        createdAt: r.createdAt,
                    })),
                };
            }
        }

        return {
            onboardingId: onboarding.id,
            organizationId: onboarding.organizationId,
            organizationName: onboarding.organization.name,
            organizationStatus: onboarding.organization.status,
            onboardingStatus: onboarding.status,
            flowName: onboarding.onboardingFlow.name,
            assignee: onboarding.assignee
                ? {
                    id: onboarding.assignee.id,
                    email: onboarding.assignee.email,
                    name: [onboarding.assignee.firstName, onboarding.assignee.lastName].filter(Boolean).join(' '),
                }
                : null,
            progress: {
                completedPhases,
                totalPhases,
                percentComplete: totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0,
            },
            currentPhase: currentPhase
                ? {
                    id: currentPhase.id,
                    name: currentPhase.name,
                    phaseCategory: currentPhase.phaseCategory,
                    order: currentPhase.order,
                    status: currentPhase.status,
                }
                : null,
            actionRequired,
            actionMessage,
            actionBy,
            blockerDetails,
            phases: phaseSummaries,
            timeline: {
                startedAt: onboarding.startedAt,
                completedAt: onboarding.completedAt,
                approvedAt: onboarding.approvedAt,
                expiresAt: onboarding.expiresAt,
            },
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Validate a phase belongs to the org's onboarding and is in correct state.
     */
    private async getAndValidatePhase(
        tenantId: string,
        organizationId: string,
        phaseId: string,
        expectedCategory: string,
    ) {
        const phase = await prisma.onboardingPhase.findFirst({
            where: { id: phaseId, tenantId },
            include: { onboarding: true },
        });

        if (!phase) {
            throw new NotFoundError('Onboarding phase not found');
        }

        if (phase.onboarding.organizationId !== organizationId) {
            throw new ForbiddenError('Phase does not belong to this organization');
        }

        if (phase.status !== PhaseStatus.IN_PROGRESS) {
            throw new ValidationError(`Phase is not active (status: ${phase.status})`);
        }

        if (phase.phaseCategory !== expectedCategory) {
            throw new ValidationError(`Expected ${expectedCategory} phase, got ${phase.phaseCategory}`);
        }

        return phase;
    }

    /**
     * Fetch full onboarding with all includes.
     */
    private async fetchOnboarding(onboardingId: string, tx?: any) {
        const db = tx || prisma;
        return db.organizationOnboarding.findUnique({
            where: { id: onboardingId },
            include: this.fullOnboardingInclude(),
        });
    }

    /**
     * Standard include for full onboarding response.
     */
    private fullOnboardingInclude() {
        return {
            organization: {
                select: { id: true, name: true, status: true },
            },
            assignee: {
                select: { id: true, email: true, firstName: true, lastName: true },
            },
            approvedBy: {
                select: { id: true, email: true, firstName: true, lastName: true },
            },
            onboardingFlow: {
                select: { id: true, name: true },
            },
            currentPhase: {
                select: { id: true, name: true, phaseCategory: true, order: true },
            },
            phases: {
                orderBy: { order: 'asc' as const },
                include: {
                    questionnairePhase: {
                        include: {
                            fields: { orderBy: { order: 'asc' as const } },
                        },
                    },
                    documentationPhase: {
                        include: {
                            stageProgress: { orderBy: { order: 'asc' as const } },
                        },
                    },
                    gatePhase: {
                        include: {
                            reviews: {
                                include: {
                                    reviewer: {
                                        select: { id: true, firstName: true, lastName: true },
                                    },
                                },
                                orderBy: { createdAt: 'desc' as const },
                            },
                        },
                    },
                },
            },
        };
    }
}

export const onboardingService = new OnboardingService();
