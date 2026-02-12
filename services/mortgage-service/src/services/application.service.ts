import { prisma as defaultPrisma } from '../lib/prisma';
import {
    AppError,
    PrismaClient,
    StepType,
    ApplicationStatus,
    ApplicationTrigger,
    PhaseStatus,
    StepStatus,
    computePhaseActionStatus,
    computeStepActionStatus,
    NextActor,
    ActionCategory,
    ApplicationActionStatus,
    PhaseActionStatus,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    CreateApplicationInput,
    UpdateApplicationInput,
    TransitionApplicationInput,
} from '../validators/application.validator';
import { createPaymentMethodService } from './payment-method.service';
import { unitLockingService } from './unit-locking.service';
import {
    sendApplicationCreatedNotification,
    sendApplicationActivatedNotification,
    formatCurrency,
    formatDate,
} from '../lib/notifications';

type AnyPrismaClient = PrismaClient;

// Dashboard URL base
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.contribuild.com';

/**
 * Generate a unique application number
 */
function generateApplicationNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CTR-${timestamp}-${random}`;
}

/**
 * Calculate monthly payment using standard amortization formula
 */
function calculatePeriodicPayment(
    principal: number,
    annualRate: number,
    termMonths: number
): number {
    if (annualRate === 0) {
        return principal / termMonths;
    }

    const monthlyRate = annualRate / 100 / 12;
    const payment =
        (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);

    return Math.round(payment * 100) / 100;
}

/**
 * Extract mortgage payment info from application phases
 * The mortgage phase has a payment plan with term and interest rate
 * Now reads from PaymentPhase extension table
 */
function getMortgagePaymentInfo(application: any): { termMonths: number; monthlyPayment: number } {
    // Find the mortgage phase (phaseType = 'MORTGAGE')
    const mortgagePhase = application.phases?.find(
        (phase: any) => phase.phaseType === 'MORTGAGE'
    );

    // PaymentPhase extension contains the payment plan reference
    const paymentPhase = mortgagePhase?.paymentPhase;
    if (!paymentPhase?.paymentPlan) {
        return { termMonths: 0, monthlyPayment: 0 };
    }

    const paymentPlan = paymentPhase.paymentPlan;
    const termMonths = paymentPlan.numberOfInstallments || 0;
    const interestRate = paymentPhase.interestRate || 0;
    const principal = paymentPhase.totalAmount;

    if (termMonths > 0 && principal > 0) {
        const monthlyPayment = calculatePeriodicPayment(principal, interestRate, termMonths);
        return { termMonths, monthlyPayment };
    }

    return { termMonths: 0, monthlyPayment: 0 };
}


/**
 * Simple state machine for application states
 */
function getNextState(currentState: ApplicationStatus, trigger: ApplicationTrigger): ApplicationStatus | null {
    const transitions: Record<ApplicationStatus, Partial<Record<ApplicationTrigger, ApplicationStatus>>> = {
        DRAFT: {
            [ApplicationTrigger.SUBMIT]: ApplicationStatus.PENDING,
            [ApplicationTrigger.CANCEL]: ApplicationStatus.CANCELLED,
        },
        PENDING: {
            [ApplicationTrigger.APPROVE]: ApplicationStatus.ACTIVE,
            [ApplicationTrigger.REJECT]: ApplicationStatus.CANCELLED,
            [ApplicationTrigger.CANCEL]: ApplicationStatus.CANCELLED,
        },
        ACTIVE: {
            [ApplicationTrigger.COMPLETE]: ApplicationStatus.COMPLETED,
            [ApplicationTrigger.TERMINATE]: ApplicationStatus.TERMINATED,
            [ApplicationTrigger.TRANSFER]: ApplicationStatus.TRANSFERRED,
            [ApplicationTrigger.SUPERSEDE]: ApplicationStatus.SUPERSEDED,
        },
        COMPLETED: {},
        CANCELLED: {},
        TERMINATED: {},
        TRANSFERRED: {},
        SUPERSEDED: {
            // Superseded applications can be transferred to different unit or cancelled
            [ApplicationTrigger.TRANSFER]: ApplicationStatus.TRANSFERRED,
            [ApplicationTrigger.CANCEL]: ApplicationStatus.CANCELLED,
        },
    };

    return transitions[currentState]?.[trigger] ?? null;
}

function mapStateToStatus(state: ApplicationStatus): ApplicationStatus {
    // State and status are now the same type
    return state;
}

/**
 * Enrich a step with action status
 */
function enrichStepWithActionStatus(step: any): any {
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
 * Enrich a phase with action status
 */
function enrichPhaseWithActionStatus(phase: any): any {
    // Enrich steps if present
    if (phase.documentationPhase?.steps) {
        phase.documentationPhase.steps = phase.documentationPhase.steps.map(
            (step: any) => enrichStepWithActionStatus(step)
        );
    }

    // Compute phase action status
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
 * Enrich an application with action status at all levels
 */
function enrichApplicationWithActionStatus(application: any): any {
    // Enrich all phases
    const enrichedPhases = application.phases?.map((phase: any) =>
        enrichPhaseWithActionStatus(phase)
    ) || [];

    // Find current phase and compute application-level status
    const currentPhase = enrichedPhases.find(
        (p: any) => p.id === application.currentPhaseId
    ) || enrichedPhases.find(
        (p: any) => p.status === 'IN_PROGRESS' || p.status === 'ACTIVE'
    );

    // Compute application-level action status
    let applicationActionStatus: ApplicationActionStatus;

    if (application.status === 'COMPLETED') {
        applicationActionStatus = {
            applicationId: application.id,
            applicationNumber: application.applicationNumber,
            nextActor: NextActor.NONE,
            actionCategory: ActionCategory.COMPLETED,
            actionRequired: 'Application completed',
            isBlocking: false,
        };
    } else if (application.status === 'CANCELLED' || application.status === 'TERMINATED') {
        applicationActionStatus = {
            applicationId: application.id,
            applicationNumber: application.applicationNumber,
            nextActor: NextActor.NONE,
            actionCategory: ActionCategory.COMPLETED,
            actionRequired: `Application ${application.status.toLowerCase()}`,
            isBlocking: false,
        };
    } else if (application.status === 'DRAFT') {
        applicationActionStatus = {
            applicationId: application.id,
            applicationNumber: application.applicationNumber,
            nextActor: NextActor.CUSTOMER,
            actionCategory: ActionCategory.UPLOAD,
            actionRequired: 'Submit application for review',
            isBlocking: true,
        };
    } else if (currentPhase) {
        applicationActionStatus = {
            applicationId: application.id,
            applicationNumber: application.applicationNumber,
            nextActor: currentPhase.actionStatus?.nextActor || NextActor.CUSTOMER,
            actionCategory: currentPhase.actionStatus?.actionCategory || ActionCategory.UPLOAD,
            actionRequired: currentPhase.actionStatus?.actionRequired || 'Action required',
            progress: currentPhase.actionStatus?.progress,
            currentPhase: currentPhase.actionStatus,
            phasesProgress: `Phase ${currentPhase.order + 1} of ${enrichedPhases.length}`,
            isBlocking: true,
        };
    } else {
        applicationActionStatus = {
            applicationId: application.id,
            applicationNumber: application.applicationNumber,
            nextActor: NextActor.CUSTOMER,
            actionCategory: ActionCategory.WAITING,
            actionRequired: 'Pending',
            isBlocking: true,
        };
    }

    return {
        ...application,
        phases: enrichedPhases,
        actionStatus: applicationActionStatus,
    };
}

/**
 * Application service interface
 */
export interface ApplicationService {
    create(data: CreateApplicationInput): Promise<any>;
    findAll(filters?: {
        buyerId?: string;
        propertyUnitId?: string;
        status?: ApplicationStatus;
        page?: number;
        limit?: number;
        /** Filter applications by specific IDs (for organization staff filtering) */
        applicationIds?: string[];
    }): Promise<{
        items: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    findById(id: string): Promise<any>;
    findByApplicationNumber(applicationNumber: string): Promise<any>;
    update(id: string, data: UpdateApplicationInput, userId: string): Promise<any>;
    transition(id: string, data: TransitionApplicationInput, userId: string): Promise<any>;
    sign(id: string, userId: string): Promise<any>;
    cancel(id: string, userId: string, reason?: string): Promise<any>;
    delete(id: string, userId: string): Promise<{ success: boolean }>;
    getCurrentAction(id: string, userId?: string, userOrgTypeIds?: string[]): Promise<any>;
}

/**
 * Create a application service with the given Prisma client
 * Use this for tenant-scoped operations
 */
export function createApplicationService(prisma: AnyPrismaClient = defaultPrisma): ApplicationService {
    const paymentMethodService = createPaymentMethodService(prisma);

    async function create(data: CreateApplicationInput): Promise<any> {
        const method = await paymentMethodService.findById(data.paymentMethodId);

        if (!method.isActive) {
            throw new AppError(400, 'Payment method is not active');
        }

        if (method.phases.length === 0) {
            throw new AppError(400, 'Payment method has no phases configured');
        }

        const propertyUnit = await prisma.propertyUnit.findUnique({
            where: { id: data.propertyUnitId },
            include: {
                variant: {
                    include: {
                        property: true,
                    },
                },
            },
        });

        if (!propertyUnit) {
            throw new AppError(404, 'Property unit not found');
        }

        if (propertyUnit.status !== 'AVAILABLE') {
            throw new AppError(400, `Property unit is not available (status: ${propertyUnit.status})`);
        }

        const buyer = await prisma.user.findUnique({
            where: { id: data.buyerId },
        });

        if (!buyer) {
            throw new AppError(404, 'Buyer not found');
        }

        // Prevent duplicate active applications for the same unit/buyer combination
        const existingApplication = await prisma.application.findFirst({
            where: {
                propertyUnitId: data.propertyUnitId,
                buyerId: data.buyerId,
                status: {
                    in: ['DRAFT', 'ACTIVE', 'PENDING'],
                },
            },
            select: {
                id: true,
                applicationNumber: true,
                status: true,
            },
        });

        if (existingApplication) {
            throw new AppError(
                409,
                `Buyer already has an active application (${existingApplication.applicationNumber}) for this unit`
            );
        }

        const unitPrice = propertyUnit.priceOverride ?? propertyUnit.variant.price;
        const totalAmount = data.totalAmount ?? unitPrice;

        const application = await prisma.$transaction(async (tx: any) => {
            await tx.propertyUnit.update({
                where: { id: data.propertyUnitId },
                data: {
                    status: 'RESERVED',
                    reservedAt: new Date(),
                    reservedById: data.buyerId,
                },
            });

            await tx.propertyVariant.update({
                where: { id: propertyUnit.variantId },
                data: {
                    availableUnits: { decrement: 1 },
                    reservedUnits: { increment: 1 },
                },
            });

            const created = await tx.application.create({
                data: {
                    tenantId: (data as any).tenantId,
                    propertyUnitId: data.propertyUnitId,
                    buyerId: data.buyerId,
                    sellerId: data.sellerId ?? propertyUnit.variant.property.userId,
                    paymentMethodId: data.paymentMethodId,
                    applicationNumber: generateApplicationNumber(),
                    title: data.title,
                    description: data.description,
                    applicationType: data.applicationType,
                    totalAmount,
                    status: 'DRAFT',
                    startDate: data.startDate ? new Date(data.startDate) : null,
                },
            });

            // Track the most recent questionnaire phase for conditional step linking
            // Documentation phases use the immediately preceding questionnaire's answers
            let lastQuestionnairePhaseId: string | null = null;

            for (const phaseTemplate of method.phases) {
                let phaseAmount: number | null = null;
                if (phaseTemplate.percentOfPrice) {
                    phaseAmount = (totalAmount * phaseTemplate.percentOfPrice) / 100;
                } else if (phaseTemplate.phaseCategory === 'DOCUMENTATION' || phaseTemplate.phaseCategory === 'QUESTIONNAIRE') {
                    phaseAmount = 0; // Non-payment phases have no monetary amount
                }

                // Create base ApplicationPhase (shared fields only)
                const phase = await tx.applicationPhase.create({
                    data: {
                        tenantId: (data as any).tenantId,
                        applicationId: created.id,
                        phaseTemplateId: phaseTemplate.id, // Link to source template for config lookup
                        name: phaseTemplate.name,
                        description: phaseTemplate.description,
                        phaseCategory: phaseTemplate.phaseCategory,
                        phaseType: phaseTemplate.phaseType,
                        order: phaseTemplate.order,
                        status: 'PENDING' as PhaseStatus,
                        requiresPreviousPhaseCompletion: phaseTemplate.requiresPreviousPhaseCompletion,
                    },
                });

                // Create appropriate extension record based on phaseCategory
                if (phaseTemplate.phaseCategory === 'QUESTIONNAIRE') {
                    // Get questions from questionnaire plan if available
                    const questionnairePlan = phaseTemplate.questionnairePlan;
                    const questions = questionnairePlan?.questions || [];

                    // Create QuestionnairePhase extension
                    const questionnairePhase = await tx.questionnairePhase.create({
                        data: {
                            tenantId: (data as any).tenantId,
                            phaseId: phase.id,
                            questionnairePlanId: phaseTemplate.questionnairePlanId,
                            totalFieldsCount: questions.length,
                            completedFieldsCount: 0,
                            // Copy scoring config from plan
                            passingScore: questionnairePlan?.passingScore,
                            fieldsSnapshot: questionnairePlan ? {
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
                                scoringStrategy: questionnairePlan.scoringStrategy,
                                passingScore: questionnairePlan.passingScore,
                                autoDecisionEnabled: questionnairePlan.autoDecisionEnabled,
                            } : phaseTemplate.stepDefinitionsSnapshot,
                        },
                    });

                    // Track this questionnaire for linking to subsequent documentation phases
                    lastQuestionnairePhaseId = questionnairePhase.id;

                    // Create QuestionnaireField records from plan questions
                    for (const question of questions) {
                        await tx.questionnaireField.create({
                            data: {
                                tenantId: (data as any).tenantId,
                                questionnairePhaseId: questionnairePhase.id,
                                name: question.questionKey,
                                fieldType: question.questionType,
                                label: question.questionText,
                                description: question.helpText,
                                order: question.order,
                                isRequired: question.isRequired ?? true,
                                validation: question.validationRules,
                                // options stored in validation or defaultValue if needed
                                defaultValue: question.options ? { options: question.options } : undefined,
                            },
                        });
                    }
                } else if (phaseTemplate.phaseCategory === 'DOCUMENTATION') {
                    // Get document definitions and approval stages from the plan
                    const documentationPlan = phaseTemplate.documentationPlan;
                    const documentDefinitions = documentationPlan?.documentDefinitions || [];
                    const approvalStages = documentationPlan?.approvalStages || [];

                    // Calculate required documents count
                    const requiredDocsCount = documentDefinitions.filter((d: any) => d.isRequired).length;

                    // Create DocumentationPhase extension with stage-based workflow
                    const documentationPhase = await tx.documentationPhase.create({
                        data: {
                            tenantId: (data as any).tenantId,
                            phaseId: phase.id,
                            documentationPlanId: phaseTemplate.documentationPlanId,
                            // Link to source questionnaire for conditional document evaluation
                            sourceQuestionnairePhaseId: lastQuestionnairePhaseId,
                            // Stage-based workflow: start at stage 1
                            currentStageOrder: 1,
                            requiredDocumentsCount: requiredDocsCount,
                            approvedDocumentsCount: 0,
                            // Snapshots for audit
                            documentDefinitionsSnapshot: documentDefinitions.length > 0 ? documentDefinitions.map((d: any) => ({
                                documentType: d.documentType,
                                documentName: d.documentName,
                                uploadedBy: d.uploadedBy,
                                order: d.order,
                                isRequired: d.isRequired,
                                description: d.description,
                                maxSizeBytes: d.maxSizeBytes,
                                allowedMimeTypes: d.allowedMimeTypes,
                                expiryDays: d.expiryDays,
                                minFiles: d.minFiles,
                                maxFiles: d.maxFiles,
                                condition: d.condition,
                            })) : null,
                            approvalStagesSnapshot: approvalStages.length > 0 ? approvalStages.map((s: any) => ({
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
                            })) : null,
                        },
                    });

                    // Create ApprovalStageProgress records for each approval stage
                    for (const stage of approvalStages) {
                        await tx.approvalStageProgress.create({
                            data: {
                                tenantId: (data as any).tenantId,
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
                                // First stage is IN_PROGRESS, others are PENDING
                                status: stage.order === 1 ? 'IN_PROGRESS' : 'PENDING',
                                activatedAt: stage.order === 1 ? new Date() : null,
                            },
                        });
                    }
                } else if (phaseTemplate.phaseCategory === 'PAYMENT') {
                    // For flexible-term plans (like mortgages), use user's selected term
                    const paymentPlan = phaseTemplate.paymentPlan;
                    let selectedTermMonths: number | null = null;
                    let numberOfInstallments: number | null = null;

                    if (paymentPlan?.allowFlexibleTerm && phaseTemplate.phaseType === 'MORTGAGE') {
                        const userSelectedTerm = (data as any).selectedMortgageTermMonths;
                        const applicantAge = (data as any).applicantAge;

                        if (userSelectedTerm) {
                            // Validate user-selected term is within allowed range
                            const minTerm = paymentPlan.minTermMonths || 12;
                            const maxTerm = paymentPlan.maxTermMonths || 360;

                            // Calculate maximum allowed term based on age if maxAgeAtMaturity is set
                            let effectiveMaxTerm = maxTerm;
                            if (applicantAge && paymentPlan.maxAgeAtMaturity) {
                                const yearsUntilMaxAge = paymentPlan.maxAgeAtMaturity - applicantAge;
                                const maxTermByAge = yearsUntilMaxAge * 12;
                                effectiveMaxTerm = Math.min(maxTerm, maxTermByAge);
                            }

                            if (userSelectedTerm < minTerm || userSelectedTerm > effectiveMaxTerm) {
                                throw new AppError(400,
                                    `Selected mortgage term ${userSelectedTerm} months is outside allowed range (${minTerm}-${effectiveMaxTerm} months)`
                                );
                            }

                            selectedTermMonths = userSelectedTerm;
                            numberOfInstallments = userSelectedTerm; // Monthly installments = term in months
                        }
                    }

                    // Create PaymentPhase extension
                    await tx.paymentPhase.create({
                        data: {
                            tenantId: (data as any).tenantId,
                            phaseId: phase.id,
                            paymentPlanId: phaseTemplate.paymentPlanId,
                            totalAmount: phaseAmount ?? 0,
                            paidAmount: 0,
                            interestRate: phaseTemplate.interestRate ?? 0,
                            collectFunds: phaseTemplate.collectFunds ?? phaseTemplate.paymentPlan?.collectFunds ?? true,
                            minimumCompletionPercentage: phaseTemplate.minimumCompletionPercentage,
                            paymentPlanSnapshot: phaseTemplate.paymentPlan ? JSON.parse(JSON.stringify(phaseTemplate.paymentPlan)) : null,
                            // Flexible-term fields
                            selectedTermMonths,
                            numberOfInstallments,
                        },
                    });
                }
            }

            // =========================================================================
            // AUTO-BIND DEVELOPER ORGANIZATION
            // =========================================================================
            // If the property has an organizationId, automatically bind that organization
            // to this application as DEVELOPER. This allows the developer's team members
            // to upload documents and participate in the application workflow.
            // Only bind if the organization is ACTIVE (completed onboarding if required).
            // =========================================================================
            if (propertyUnit.variant.property.organizationId) {
                const devOrgId = propertyUnit.variant.property.organizationId;

                // Verify the developer organization is ACTIVE
                const devOrg = await tx.organization.findUnique({
                    where: { id: devOrgId },
                    select: { id: true, status: true, name: true },
                });

                if (devOrg && devOrg.status !== 'ACTIVE') {
                    throw new AppError(400,
                        `Developer organization "${devOrg.name}" is not active (status: ${devOrg.status}). ` +
                        `Organization must complete onboarding before properties can be sold.`
                    );
                }

                // Look up the DEVELOPER organization type
                const developerType = await tx.organizationType.findFirst({
                    where: {
                        tenantId: (data as any).tenantId,
                        code: 'DEVELOPER',
                    },
                });

                if (developerType) {
                    // Verify the organization actually has the DEVELOPER type
                    const orgHasDevType = await tx.organizationTypeAssignment.findFirst({
                        where: {
                            organizationId: devOrgId,
                            typeId: developerType.id,
                        },
                    });

                    if (orgHasDevType) {
                        await tx.applicationOrganization.create({
                            data: {
                                tenantId: (data as any).tenantId,
                                applicationId: created.id,
                                organizationId: devOrgId,
                                assignedAsTypeId: developerType.id,
                                status: 'ACTIVE',
                                isPrimary: true,
                                assignedById: data.buyerId, // Auto-assigned by system on behalf of buyer
                                assignedAt: new Date(),
                                activatedAt: new Date(),
                            },
                        });
                    }
                }
            }

            // Audit trail (permanent record)
            await tx.applicationEvent.create({
                data: {
                    tenantId: (data as any).tenantId,
                    applicationId: created.id,
                    eventType: 'APPLICATION_CREATED',
                    eventGroup: 'STATE_CHANGE',
                    data: {
                        applicationNumber: created.applicationNumber,
                        buyerId: data.buyerId,
                        propertyUnitId: data.propertyUnitId,
                        totalAmount,
                        applicationType: data.applicationType,
                    },
                    actorId: data.buyerId,
                    actorType: 'USER',
                },
            });

            // Inter-service communication (triggers notifications)
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: created.tenantId,
                    eventType: 'APPLICATION.CREATED',
                    aggregateType: 'Application',
                    aggregateId: created.id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        applicationId: created.id,
                        applicationNumber: created.applicationNumber,
                        buyerId: data.buyerId,
                        propertyUnitId: data.propertyUnitId,
                        totalAmount,
                    }),
                    actorId: data.buyerId,
                },
            });

            // Smart auto-submit: if saveDraft is false (default) and all required fields are present,
            // automatically transition to PENDING and activate the first phase
            const shouldAutoSubmit = !data.saveDraft && data.paymentMethodId && data.propertyUnitId;

            if (shouldAutoSubmit) {
                // Update application status to PENDING
                await tx.application.update({
                    where: { id: created.id },
                    data: { status: 'PENDING' },
                });
                created.status = 'PENDING';

                // Activate the first phase
                const firstPhase = await tx.applicationPhase.findFirst({
                    where: { applicationId: created.id },
                    orderBy: { order: 'asc' },
                });

                if (firstPhase && firstPhase.status === 'PENDING') {
                    await tx.applicationPhase.update({
                        where: { id: firstPhase.id },
                        data: {
                            status: 'IN_PROGRESS',
                            activatedAt: new Date(),
                        },
                    });

                    await tx.application.update({
                        where: { id: created.id },
                        data: { currentPhaseId: firstPhase.id },
                    });

                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            tenantId: created.tenantId,
                            eventType: 'PHASE.ACTIVATED',
                            aggregateType: 'ApplicationPhase',
                            aggregateId: firstPhase.id,
                            queueName: 'application-steps',
                            payload: JSON.stringify({
                                phaseId: firstPhase.id,
                                applicationId: created.id,
                                phaseType: firstPhase.phaseType,
                            }),
                            actorId: data.buyerId,
                        },
                    });
                }
            }

            return created;
        });

        const fullApplication = await findById(application.id);

        // Send application created notification
        try {
            // Get mortgage payment info from phases
            const mortgageInfo = getMortgagePaymentInfo(fullApplication);

            await sendApplicationCreatedNotification({
                email: buyer.email,
                userName: buyer.firstName || 'Valued Customer',
                applicationNumber: fullApplication.applicationNumber,
                propertyName: propertyUnit.variant?.property?.title || 'Your Property',
                totalAmount: formatCurrency(totalAmount),
                termMonths: mortgageInfo.termMonths,
                monthlyPayment: formatCurrency(mortgageInfo.monthlyPayment),
                dashboardUrl: `${DASHBOARD_URL}/applications/${application.id}`,
            }, application.id);
        } catch (error) {
            console.error('[Application] Failed to send created notification', { id: application.id, error });
        }

        return fullApplication;
    }

    async function findAll(filters?: {
        buyerId?: string;
        propertyUnitId?: string;
        status?: ApplicationStatus;
        page?: number;
        limit?: number;
        /** Filter applications by specific IDs (for organization staff filtering) */
        applicationIds?: string[];
    }) {
        const page = filters?.page || 1;
        const limit = filters?.limit || 20;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {
            buyerId: filters?.buyerId,
            propertyUnitId: filters?.propertyUnitId,
            status: filters?.status,
        };

        // Filter by specific application IDs if provided (for org staff)
        if (filters?.applicationIds) {
            where.id = { in: filters.applicationIds };
        }

        const [items, total] = await Promise.all([
            prisma.application.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    propertyUnit: {
                        include: {
                            variant: {
                                include: {
                                    property: true,
                                },
                            },
                        },
                    },
                    buyer: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    paymentMethod: true,
                    phases: {
                        orderBy: { order: 'asc' },
                    },
                },
            }),
            prisma.application.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async function findById(id: string): Promise<any> {
        const application = await prisma.application.findUnique({
            where: { id },
            include: {
                propertyUnit: {
                    include: {
                        variant: {
                            include: {
                                property: true,
                                amenities: {
                                    include: {
                                        amenity: true,
                                    },
                                },
                            },
                        },
                    },
                },
                buyer: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                seller: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                paymentMethod: true,
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        // Include polymorphic extensions
                        questionnairePhase: {
                            include: {
                                fields: true,
                            },
                        },
                        documentationPhase: {
                            include: {
                                stageProgress: {
                                    orderBy: { order: 'asc' },
                                },
                                documentationPlan: {
                                    include: {
                                        documentDefinitions: true,
                                        approvalStages: true,
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
                    },
                },
                documents: true,
                payments: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        // Enrich phases with action status
        return enrichApplicationWithActionStatus(application);
    }

    async function findByApplicationNumber(applicationNumber: string) {
        const application = await prisma.application.findUnique({
            where: { applicationNumber },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        return application;
    }

    async function update(id: string, data: UpdateApplicationInput, userId: string) {
        const application = await findById(id);

        if (application.buyerId !== userId && application.sellerId !== userId) {
            throw new AppError(403, 'Unauthorized to update this application');
        }

        const updated = await prisma.application.update({
            where: { id },
            data,
        });

        return findById(updated.id);
    }

    async function transition(id: string, data: TransitionApplicationInput, userId: string) {
        const application = await findById(id);

        const fromStatus = application.status;
        const toStatus = getNextState(fromStatus, data.trigger);

        if (!toStatus) {
            throw new AppError(400, `Invalid transition: ${data.trigger} from status ${fromStatus}`);
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const result = await tx.application.update({
                where: { id },
                data: {
                    status: toStatus,
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: application.tenantId,
                    eventType: 'APPLICATION.STATE_CHANGED',
                    aggregateType: 'Application',
                    aggregateId: id,
                    queueName: 'application-steps',
                    payload: JSON.stringify({
                        applicationId: id,
                        fromStatus,
                        toStatus,
                        trigger: data.trigger,
                    }),
                    actorId: userId,
                },
            });

            // Auto-activate first phase when application is submitted (DRAFT -> PENDING)
            if (data.trigger === 'SUBMIT' && toStatus === 'PENDING') {
                const firstPhase = await tx.applicationPhase.findFirst({
                    where: { applicationId: id },
                    orderBy: { order: 'asc' },
                });

                if (firstPhase && firstPhase.status === 'PENDING') {
                    await tx.applicationPhase.update({
                        where: { id: firstPhase.id },
                        data: {
                            status: 'IN_PROGRESS',
                            activatedAt: new Date(),
                        },
                    });

                    await tx.application.update({
                        where: { id },
                        data: { currentPhaseId: firstPhase.id },
                    });

                    await tx.domainEvent.create({
                        data: {
                            id: uuidv4(),
                            tenantId: application.tenantId,
                            eventType: 'PHASE.ACTIVATED',
                            aggregateType: 'ApplicationPhase',
                            aggregateId: firstPhase.id,
                            queueName: 'application-steps',
                            payload: JSON.stringify({
                                phaseId: firstPhase.id,
                                applicationId: id,
                                phaseType: firstPhase.phaseType,
                            }),
                            actorId: userId,
                        },
                    });
                }
            }

            return result;
        });

        return findById(updated.id);
    }

    async function sign(id: string, userId: string) {
        const application = await findById(id);

        if (application.signedAt) {
            throw new AppError(400, 'Application already signed');
        }

        if (application.buyerId !== userId) {
            throw new AppError(403, 'Only the buyer can sign the application');
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const result = await tx.application.update({
                where: { id },
                data: {
                    signedAt: new Date(),
                    status: 'ACTIVE',
                },
            });

            // Write APPLICATION.SIGNED domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: application.tenantId,
                    eventType: 'APPLICATION.SIGNED',
                    aggregateType: 'Application',
                    aggregateId: id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        applicationId: id,
                        buyerId: application.buyerId,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        const activatedApplication = await findById(updated.id);

        // Send application activated notification
        try {
            // Find next payment due date from first payment phase's installments
            const firstPaymentPhase = activatedApplication.phases?.find(
                (p: any) => p.phaseCategory === 'PAYMENT' && p.paymentPhase?.installments?.length > 0
            );
            const firstInstallment = firstPaymentPhase?.paymentPhase?.installments?.[0];
            const nextPaymentDate = firstInstallment?.dueDate
                ? formatDate(firstInstallment.dueDate)
                : 'To be scheduled';

            // Get mortgage payment info from phases
            const mortgageInfo = getMortgagePaymentInfo(activatedApplication);

            await sendApplicationActivatedNotification({
                email: application.buyer?.email || '',
                userName: application.buyer?.firstName || 'Valued Customer',
                applicationNumber: application.applicationNumber,
                propertyName: application.propertyUnit?.variant?.property?.title || 'Your Property',
                startDate: formatDate(new Date()),
                nextPaymentDate,
                monthlyPayment: formatCurrency(mortgageInfo.monthlyPayment || 0),
                dashboardUrl: `${DASHBOARD_URL}/applications/${id}`,
            }, id);
        } catch (error) {
            console.error('[Application] Failed to send activated notification', { id, error });
        }

        return activatedApplication;
    }

    async function cancel(id: string, userId: string, reason?: string) {
        const application = await findById(id);

        if (application.status === 'COMPLETED' || application.status === 'CANCELLED') {
            throw new AppError(400, `Cannot cancel application in ${application.status} status`);
        }

        // Release the unit lock before cancelling
        try {
            await unitLockingService.releaseUnitLock(
                application.tenantId,
                id,
                userId
            );
        } catch (error) {
            console.error('[Application] Failed to release unit lock on cancel', { id, error });
            // Continue with cancellation even if release fails
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const result = await tx.application.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    terminatedAt: new Date(),
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    tenantId: application.tenantId,
                    eventType: 'APPLICATION.CANCELLED',
                    aggregateType: 'Application',
                    aggregateId: id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        applicationId: id,
                        buyerId: application.buyerId,
                        reason,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        return findById(updated.id);
    }

    async function deleteApplication(id: string, userId: string) {
        const application = await findById(id);

        if (application.status !== 'DRAFT') {
            throw new AppError(400, 'Only draft applications can be deleted');
        }

        if (application.buyerId !== userId) {
            throw new AppError(403, 'Only the buyer can delete the application');
        }

        await prisma.$transaction(async (tx: any) => {
            await tx.applicationPayment.deleteMany({ where: { applicationId: id } });
            await tx.applicationDocument.deleteMany({ where: { applicationId: id } });

            const phases = await tx.applicationPhase.findMany({
                where: { applicationId: id },
                include: {
                    documentationPhase: true,
                    paymentPhase: true,
                    questionnairePhase: true,
                },
            });

            for (const phase of phases) {
                // Delete DocumentationPhase extension and children
                if (phase.documentationPhase) {
                    const docPhaseId = phase.documentationPhase.id;
                    const steps = await tx.documentationStep.findMany({ where: { documentationPhaseId: docPhaseId } });
                    for (const step of steps) {
                        await tx.documentationStepApproval.deleteMany({ where: { stepId: step.id } });
                        await tx.documentationStepDocument.deleteMany({ where: { stepId: step.id } });
                    }
                    await tx.documentationStep.deleteMany({ where: { documentationPhaseId: docPhaseId } });
                    await tx.documentationPhase.delete({ where: { id: docPhaseId } });
                }

                // Delete PaymentPhase extension and children
                if (phase.paymentPhase) {
                    const payPhaseId = phase.paymentPhase.id;
                    await tx.paymentInstallment.deleteMany({ where: { paymentPhaseId: payPhaseId } });
                    await tx.paymentPhase.delete({ where: { id: payPhaseId } });
                }

                // Delete QuestionnairePhase extension and children
                if (phase.questionnairePhase) {
                    const questPhaseId = phase.questionnairePhase.id;
                    await tx.questionnaireField.deleteMany({ where: { questionnairePhaseId: questPhaseId } });
                    await tx.questionnairePhase.delete({ where: { id: questPhaseId } });
                }
            }

            await tx.applicationPhase.deleteMany({ where: { applicationId: id } });
            await tx.applicationEvent.deleteMany({ where: { applicationId: id } });
            await tx.application.delete({ where: { id } });
        });

        return { success: true };
    }

    // Type definitions for party-based actions
    type PartyAction = 'UPLOAD' | 'REVIEW' | 'WAIT' | 'PAYMENT' | 'QUESTIONNAIRE' | 'NONE';

    interface PartyActionInfo {
        action: PartyAction;
        message: string;
        pendingDocuments: string[];
        assignedStaffId: string | null;
        canCurrentUserAct: boolean;
    }

    /**
     * Get the current action required for a application
     * Returns the current phase and actions for ALL parties involved
     * Each party sees their own action, eliminating complex server-side user-context logic
     * 
     * @param id - Application ID
     * @param userId - Optional user ID for determining canCurrentUserAct
     * @param userOrgTypeCodes - Optional array of organization type CODES the user belongs to
     */
    async function getCurrentAction(id: string, userId?: string, userOrgTypeCodes?: string[]): Promise<{
        applicationId: string;
        applicationStatus: ApplicationStatus;
        currentPhase: {
            id: string;
            name: string;
            phaseCategory: string;
            phaseType: string;
            status: string;
            order: number;
        } | null;
        partyActions: Record<string, PartyActionInfo>;
        userPartyType: string | null;
        reviewStage: {
            id: string;
            name: string;
            reviewerType: string;
            status: string;
            order: number;
        } | null;
        currentStep: {
            id: string;
            name: string;
            stepType: string;
            status: string;
            order: number;
            actionReason: string | null;
            submissionCount: number;
            requiredDocuments: Array<{
                documentType: string;
                isRequired: boolean;
            }>;
            latestApproval: {
                decision: string;
                comment: string | null;
                decidedAt: Date;
            } | null;
        } | null;
        uploadedDocuments: Array<{
            id: string;
            name: string;
            type: string;
            status: string;
            stepId: string | null;
            uploadedBy: string;
            createdAt: Date;
        }>;
        // Keep for backward compatibility
        actionRequired: 'NONE' | 'UPLOAD' | 'RESUBMIT' | 'SIGN' | 'REVIEW' | 'WAIT_FOR_REVIEW' | 'PAYMENT' | 'COMPLETE' | 'QUESTIONNAIRE';
        actionMessage: string;
    }> {
        // Fetch application with organization bindings for staff assignment check
        const application: any = await prisma.application.findUnique({
            where: { id },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        documentationPhase: {
                            include: {
                                stageProgress: {
                                    orderBy: { order: 'asc' },
                                    include: {
                                        organizationType: true,
                                    },
                                },
                                documentationPlan: {
                                    include: {
                                        documentDefinitions: {
                                            orderBy: { order: 'asc' },
                                        },
                                    },
                                },
                            },
                        },
                        paymentPhase: true,
                        questionnairePhase: true,
                    },
                },
                documents: {
                    orderBy: { createdAt: 'desc' },
                },
                organizations: {
                    include: {
                        assignedAsType: true,
                        assignedStaff: true,
                    },
                },
            },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        // Build organization binding map for staff assignment checks
        const orgBindingByType: Record<string, { organizationId: string; assignedStaffId: string | null }> = {};
        for (const binding of application.organizations || []) {
            const typeCode = binding.assignedAsType?.code;
            if (typeCode) {
                orgBindingByType[typeCode] = {
                    organizationId: binding.organizationId,
                    assignedStaffId: binding.assignedStaffId,
                };
            }
        }

        // Determine user's party type
        const isCustomer = userId && application.buyerId === userId;
        let userPartyType: string | null = isCustomer ? 'CUSTOMER' : null;

        // If not customer, check org type codes
        if (!userPartyType && userOrgTypeCodes && userOrgTypeCodes.length > 0) {
            // Priority: BANK > PLATFORM > DEVELOPER > LEGAL > INSURER
            const priorityOrder = ['BANK', 'LENDER', 'PLATFORM', 'DEVELOPER', 'LEGAL', 'INSURER', 'GOVERNMENT'];
            for (const type of priorityOrder) {
                if (userOrgTypeCodes.includes(type)) {
                    userPartyType = type === 'LENDER' ? 'BANK' : type; // Normalize LENDER to BANK
                    break;
                }
            }
        }

        // Helper to check if user can act for a party type
        const canUserActForParty = (partyType: string): boolean => {
            if (partyType === 'CUSTOMER') {
                return isCustomer || false;
            }
            // Check if user's org types include this party type
            const matchingTypes = partyType === 'LENDER' ? ['BANK', 'LENDER'] : [partyType];
            const hasOrgType = userOrgTypeCodes?.some(code => matchingTypes.includes(code)) || false;

            if (!hasOrgType) return false;

            // Check staff assignment - if assigned, must be this user
            const binding = orgBindingByType[partyType] || orgBindingByType[partyType === 'LENDER' ? 'BANK' : partyType];
            if (binding?.assignedStaffId && binding.assignedStaffId !== userId) {
                return false; // Someone else is assigned
            }
            return true;
        };

        // Find current phase (IN_PROGRESS or ACTIVE)
        const currentPhase = application.phases.find(
            (p: any) => p.status === 'IN_PROGRESS' || p.status === 'ACTIVE' || p.status === 'AWAITING_APPROVAL'
        );

        // If no active phase, return minimal response
        if (!currentPhase) {
            const emptyPartyActions: Record<string, PartyActionInfo> = {};
            return {
                applicationId: application.id,
                applicationStatus: application.status,
                currentPhase: null,
                partyActions: emptyPartyActions,
                userPartyType,
                reviewStage: null,
                currentStep: null,
                uploadedDocuments: application.documents.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    url: d.url,
                    status: d.status,
                    stepId: d.stepId,
                    uploadedBy: d.expectedUploader || 'CUSTOMER',
                    createdAt: d.createdAt,
                })),
                actionRequired: application.status === 'COMPLETED' ? 'COMPLETE' : 'NONE',
                actionMessage: application.status === 'COMPLETED'
                    ? 'Application completed successfully'
                    : 'No action required at this time',
            };
        }

        // Get stage progress and document requirements
        const stageProgress = currentPhase.documentationPhase?.stageProgress || [];
        const currentStageOrder = currentPhase.documentationPhase?.currentStageOrder ?? 1;
        const currentStage = stageProgress.find((s: any) => s.order === currentStageOrder);

        // Get document requirements from snapshot or plan
        let requiredDocuments: Array<{ documentType: string; isRequired: boolean; name: string; uploadedBy: string }> = [];
        const docPhase = currentPhase.documentationPhase;
        if (docPhase) {
            if (docPhase.documentDefinitionsSnapshot && Array.isArray(docPhase.documentDefinitionsSnapshot)) {
                requiredDocuments = (docPhase.documentDefinitionsSnapshot as any[]).map((d: any) => ({
                    documentType: d.documentType || d.name,
                    isRequired: d.isRequired ?? true,
                    name: d.name || d.documentType,
                    uploadedBy: d.uploadedBy || 'CUSTOMER',
                }));
            } else if (docPhase.documentationPlan?.documentDefinitions) {
                requiredDocuments = docPhase.documentationPlan.documentDefinitions.map((d: any) => ({
                    documentType: d.documentType || d.name,
                    isRequired: d.isRequired ?? true,
                    name: d.name || d.documentType,
                    uploadedBy: d.uploadedBy || 'CUSTOMER',
                }));
            }
        }

        // Get uploaded documents for this phase
        const phaseUploadedDocs = application.documents.filter(
            (d: any) => d.phaseId === currentPhase.id
        );

        // Helper to check if a document has been uploaded
        const isDocUploaded = (docType: string) => phaseUploadedDocs.some(
            (d: any) => d.type === docType || d.documentType === docType
        );

        // Initialize party actions
        const partyActions: Record<string, PartyActionInfo> = {};

        // Map uploadedBy to normalized party types
        const normalizePartyType = (uploadedBy: string): string => {
            if (uploadedBy === 'LENDER') return 'BANK';
            return uploadedBy;
        };

        // Build actions based on phase category
        if (currentPhase.phaseCategory === 'PAYMENT') {
            // Payment phase - only CUSTOMER needs to pay
            partyActions['CUSTOMER'] = {
                action: 'PAYMENT',
                message: 'Payment is required for this phase',
                pendingDocuments: [],
                assignedStaffId: null,
                canCurrentUserAct: canUserActForParty('CUSTOMER'),
            };
            // Other parties wait
            for (const [partyType] of Object.entries(orgBindingByType)) {
                if (partyType !== 'CUSTOMER') {
                    partyActions[partyType] = {
                        action: 'WAIT',
                        message: 'Waiting for customer to complete payment',
                        pendingDocuments: [],
                        assignedStaffId: orgBindingByType[partyType]?.assignedStaffId || null,
                        canCurrentUserAct: false,
                    };
                }
            }
        } else if (currentPhase.phaseCategory === 'QUESTIONNAIRE') {
            // Questionnaire phase - only CUSTOMER fills it
            const questionnairePhase = currentPhase.questionnairePhase;
            const completedCount = questionnairePhase?.completedFieldsCount || 0;
            const totalCount = questionnairePhase?.totalFieldsCount || 0;

            if (completedCount < totalCount) {
                partyActions['CUSTOMER'] = {
                    action: 'QUESTIONNAIRE',
                    message: `Please complete the ${currentPhase.name} questionnaire (${completedCount}/${totalCount} questions answered)`,
                    pendingDocuments: [],
                    assignedStaffId: null,
                    canCurrentUserAct: canUserActForParty('CUSTOMER'),
                };
            } else if (currentPhase.status === 'AWAITING_APPROVAL') {
                // Customer done, waiting for review
                partyActions['CUSTOMER'] = {
                    action: 'WAIT',
                    message: 'Your questionnaire is under review',
                    pendingDocuments: [],
                    assignedStaffId: null,
                    canCurrentUserAct: false,
                };
                // Platform reviews
                partyActions['PLATFORM'] = {
                    action: 'REVIEW',
                    message: `Please review the ${currentPhase.name} questionnaire`,
                    pendingDocuments: [],
                    assignedStaffId: orgBindingByType['PLATFORM']?.assignedStaffId || null,
                    canCurrentUserAct: canUserActForParty('PLATFORM'),
                };
            } else {
                partyActions['CUSTOMER'] = {
                    action: 'QUESTIONNAIRE',
                    message: `Please complete the ${currentPhase.name} questionnaire`,
                    pendingDocuments: [],
                    assignedStaffId: null,
                    canCurrentUserAct: canUserActForParty('CUSTOMER'),
                };
            }
        } else if (currentPhase.phaseCategory === 'DOCUMENTATION') {
            // Documentation phase - compute actions for each party based on approval stages
            //
            // Stage-aware logic: Only consider documents relevant to the current stage.
            // Stage org type → reviews docs uploaded by:
            //   PLATFORM → CUSTOMER, PLATFORM
            //   BANK     → LENDER/BANK
            //   DEVELOPER → DEVELOPER
            //   LEGAL    → LEGAL
            //   etc.

            // Map: which uploaders does a given stage org type review?
            const getUploadersForStage = (stageOrgType: string): string[] => {
                if (stageOrgType === 'PLATFORM') return ['CUSTOMER', 'PLATFORM'];
                return [stageOrgType]; // BANK reviews BANK (normalized from LENDER), DEVELOPER reviews DEVELOPER, etc.
            };

            // Determine the current review stage info
            const stageOrgType = currentStage?.organizationType?.code || 'PLATFORM';

            // DEBUG: Log stage info for troubleshooting
            console.log('[getCurrentAction] DOCUMENTATION branch debug:', JSON.stringify({
                currentStageOrder,
                stageOrgType,
                currentStageStatus: currentStage?.status,
                currentStageName: currentStage?.name,
                stageProgressCount: stageProgress.length,
                requiredDocsCount: requiredDocuments.length,
                requiredDocs: requiredDocuments.map(d => ({ documentType: d.documentType, uploadedBy: d.uploadedBy })),
                phaseUploadedDocsCount: phaseUploadedDocs.length,
                phaseUploadedDocs: phaseUploadedDocs.map((d: any) => ({ type: d.type, documentType: d.documentType, status: d.status })),
                userPartyType,
            }));

            // Partition documents into current-stage vs future-stage
            const currentStageUploaders = new Set(getUploadersForStage(stageOrgType));
            const currentStageDocs: typeof requiredDocuments = [];
            const futureStageDocs: typeof requiredDocuments = [];

            for (const doc of requiredDocuments) {
                const party = normalizePartyType(doc.uploadedBy || 'CUSTOMER');
                if (currentStageUploaders.has(party)) {
                    currentStageDocs.push(doc);
                } else {
                    futureStageDocs.push(doc);
                }
            }

            // Check pending uploads for CURRENT STAGE documents only
            const currentStagePendingByParty: Record<string, string[]> = {};
            for (const doc of currentStageDocs) {
                const party = normalizePartyType(doc.uploadedBy || 'CUSTOMER');
                if (!isDocUploaded(doc.documentType)) {
                    if (!currentStagePendingByParty[party]) currentStagePendingByParty[party] = [];
                    currentStagePendingByParty[party].push(doc.name || doc.documentType);
                }
            }

            const allCurrentStageDocsUploaded = Object.keys(currentStagePendingByParty).length === 0;

            // DEBUG: Log partition results
            console.log('[getCurrentAction] Partition results:', JSON.stringify({
                currentStageUploadersArr: Array.from(currentStageUploaders),
                currentStageDocsCount: currentStageDocs.length,
                futureStageDocsCount: futureStageDocs.length,
                currentStagePendingByParty,
                allCurrentStageDocsUploaded,
            }));

            // Parties whose docs belong to future stages
            const futureStageParties = new Set(
                futureStageDocs.map((d) => normalizePartyType(d.uploadedBy || 'CUSTOMER')),
            );

            // Compute all parties that should appear in the response
            const allParties = new Set([
                'CUSTOMER',
                ...requiredDocuments.map((d) => normalizePartyType(d.uploadedBy || 'CUSTOMER')),
                ...Object.keys(orgBindingByType),
                stageOrgType,
            ]);

            // DEBUG: Log all parties
            console.log('[getCurrentAction] allParties:', JSON.stringify({
                allPartiesArr: Array.from(allParties),
                futureStagePartiesArr: Array.from(futureStageParties),
                orgBindingByTypeKeys: Object.keys(orgBindingByType),
            }));

            for (const party of allParties) {
                const binding = orgBindingByType[party];
                const currentStagePending = currentStagePendingByParty[party] || [];

                // DEBUG: Log each party's decision path
                const isCurrentStageReviewerDebug = party === stageOrgType;
                console.log(`[getCurrentAction] Party ${party}: pending=${currentStagePending.length}, allUploaded=${allCurrentStageDocsUploaded}, isReviewer=${isCurrentStageReviewerDebug}, stageStatus=${currentStage?.status}, isFutureParty=${futureStageParties.has(party)}, isCurrentStageUploader=${currentStageUploaders.has(party)}`);

                if (currentStagePending.length > 0) {
                    // This party has current-stage documents still to upload
                    partyActions[party] = {
                        action: 'UPLOAD',
                        message: `Please upload the required documents: ${currentStagePending.join(', ')}`,
                        pendingDocuments: currentStagePending,
                        assignedStaffId: binding?.assignedStaffId || null,
                        canCurrentUserAct: canUserActForParty(party),
                    };
                } else if (!allCurrentStageDocsUploaded) {
                    // This party's current-stage docs are done, but another party on the same stage still has uploads
                    const waitingFor = Object.keys(currentStagePendingByParty).map(p => p.toLowerCase()).join(', ');
                    partyActions[party] = {
                        action: 'WAIT',
                        message: `Waiting for ${waitingFor} to upload documents`,
                        pendingDocuments: [],
                        assignedStaffId: binding?.assignedStaffId || null,
                        canCurrentUserAct: false,
                    };
                } else {
                    // All current-stage documents uploaded — now determine review vs wait
                    const isCurrentStageReviewer = party === stageOrgType;

                    if (isCurrentStageReviewer && currentStage?.status !== 'COMPLETED') {
                        // This party is the reviewer for the current stage
                        partyActions[party] = {
                            action: 'REVIEW',
                            message: `Please review the documents for: ${currentPhase.name}`,
                            pendingDocuments: [],
                            assignedStaffId: binding?.assignedStaffId || null,
                            canCurrentUserAct: canUserActForParty(party),
                        };
                    } else if (futureStageParties.has(party) && !currentStageUploaders.has(party)) {
                        // This party uploads in a FUTURE stage — tell them to wait for the current stage
                        const futurePending = futureStageDocs
                            .filter((d) => normalizePartyType(d.uploadedBy || 'CUSTOMER') === party && !isDocUploaded(d.documentType))
                            .map((d) => d.name || d.documentType);
                        partyActions[party] = {
                            action: 'WAIT',
                            message: futurePending.length > 0
                                ? `Documents needed later: ${futurePending.join(', ')} (after current review stage completes)`
                                : `Waiting for current review stage to complete`,
                            pendingDocuments: futurePending,
                            assignedStaffId: binding?.assignedStaffId || null,
                            canCurrentUserAct: false, // Can't act yet — stage not active
                        };
                    } else {
                        // Waiting for reviewer
                        const reviewerName = stageOrgType.toLowerCase();
                        partyActions[party] = {
                            action: 'WAIT',
                            message: currentStage?.status === 'COMPLETED'
                                ? 'Review completed for this stage'
                                : `Waiting for ${reviewerName} to review documents`,
                            pendingDocuments: [],
                            assignedStaffId: binding?.assignedStaffId || null,
                            canCurrentUserAct: false,
                        };
                    }
                }
            }
        }

        // Build currentStep for backward compatibility
        let currentStep: any = null;
        if (currentStage) {
            const stageOrgType = currentStage.organizationType?.code || 'PLATFORM';
            currentStep = {
                id: currentStage.id,
                name: currentStage.name,
                stepType: stageOrgType,
                status: currentStage.status,
                order: currentStage.order,
                actionReason: null,
                submissionCount: 0,
                requiredDocuments: requiredDocuments.map((d) => ({
                    documentType: d.documentType,
                    isRequired: d.isRequired,
                    name: d.name || d.documentType,
                })),
            };
        }

        // Build reviewStage info
        const reviewStage = currentStage ? {
            id: currentStage.id,
            name: currentStage.name,
            reviewerType: currentStage.organizationType?.code || 'PLATFORM',
            status: currentStage.status,
            order: currentStage.order,
        } : null;

        // Deduplicate documents by documentType, keeping only the latest one
        const uniqueDocuments = phaseUploadedDocs.reduce((acc: any[], doc: any) => {
            const existingIndex = acc.findIndex((d: any) => d.type === doc.type || d.documentType === doc.documentType);
            if (existingIndex === -1) {
                acc.push(doc);
            } else {
                const existing = acc[existingIndex];
                if (new Date(doc.createdAt) > new Date(existing.createdAt)) {
                    acc[existingIndex] = doc;
                }
            }
            return acc;
        }, []);

        // Compute backward-compatible actionRequired/actionMessage from user's party
        let actionRequired: 'NONE' | 'UPLOAD' | 'RESUBMIT' | 'SIGN' | 'REVIEW' | 'WAIT_FOR_REVIEW' | 'PAYMENT' | 'COMPLETE' | 'QUESTIONNAIRE' = 'NONE';
        let actionMessage = 'No action required';

        if (userPartyType && partyActions[userPartyType]) {
            const userAction = partyActions[userPartyType];
            switch (userAction.action) {
                case 'UPLOAD':
                    actionRequired = 'UPLOAD';
                    actionMessage = userAction.message;
                    break;
                case 'REVIEW':
                    actionRequired = 'REVIEW';
                    actionMessage = userAction.message;
                    break;
                case 'WAIT':
                    actionRequired = 'WAIT_FOR_REVIEW';
                    actionMessage = userAction.message;
                    break;
                case 'PAYMENT':
                    actionRequired = 'PAYMENT';
                    actionMessage = userAction.message;
                    break;
                case 'QUESTIONNAIRE':
                    actionRequired = 'QUESTIONNAIRE';
                    actionMessage = userAction.message;
                    break;
                default:
                    actionRequired = 'NONE';
                    actionMessage = userAction.message;
            }
        }

        return {
            applicationId: application.id,
            applicationStatus: application.status,
            currentPhase: {
                id: currentPhase.id,
                name: currentPhase.name,
                phaseCategory: currentPhase.phaseCategory,
                phaseType: currentPhase.phaseType,
                status: currentPhase.status,
                order: currentPhase.order,
            },
            partyActions,
            userPartyType,
            reviewStage,
            currentStep: currentStep
                ? {
                    id: currentStep.id,
                    name: currentStep.name,
                    stepType: currentStep.stepType,
                    status: currentStep.status,
                    order: currentStep.order,
                    actionReason: currentStep.actionReason,
                    submissionCount: currentStep.submissionCount ?? 0,
                    requiredDocuments: currentStep.requiredDocuments.map((d: any) => ({
                        documentType: d.documentType,
                        isRequired: d.isRequired,
                        name: d.name || d.documentType,
                    })),
                    latestApproval: null,
                }
                : null,
            uploadedDocuments: uniqueDocuments.map((d: any) => ({
                id: d.id,
                name: d.name,
                type: d.type,
                url: d.url,
                status: d.status,
                stepId: d.stepId,
                uploadedBy: d.expectedUploader || 'CUSTOMER',
                createdAt: d.createdAt,
            })),
            actionRequired,
            actionMessage,
        };
    }

    return {
        create,
        findAll,
        findById,
        findByApplicationNumber,
        update,
        transition,
        sign,
        cancel,
        delete: deleteApplication,
        getCurrentAction,
    };
}

// Default instance for backward compatibility
export const applicationService: ApplicationService = createApplicationService();
