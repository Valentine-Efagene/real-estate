import { prisma as defaultPrisma } from '../lib/prisma';
import {
    AppError,
    PrismaClient,
    StepType,
    ApplicationStatus,
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
 * Parse step definitions from phase template
 * Now reads from the child table `steps` or from `documentationPlan.steps`
 */
function parseStepDefinitions(phaseTemplate: {
    steps?: Array<{
        name: string;
        stepType: StepType;
        order: number;
        metadata?: any;
    }>;
    documentationPlan?: {
        steps: Array<{
            name: string;
            stepType: string;
            order: number;
            metadata?: any;
        }>;
    } | null;
    requiredDocuments?: Array<{
        documentType: string;
        isRequired: boolean;
    }>;
}): Array<{
    name: string;
    description?: string;
    stepType: StepType;
    order: number;
    metadata?: any;
    requiredDocuments?: Array<{
        documentType: string;
        isRequired: boolean;
    }>;
}> {
    // If we have normalized steps from the phase template, use them first
    if (phaseTemplate.steps && phaseTemplate.steps.length > 0) {
        return phaseTemplate.steps.map((step, idx) => ({
            name: step.name,
            stepType: step.stepType,
            order: step.order,
            metadata: step.metadata, // Include metadata for GENERATE_DOCUMENT steps
        }));
    }

    // If we have a documentation plan with steps, use those
    if (phaseTemplate.documentationPlan?.steps && phaseTemplate.documentationPlan.steps.length > 0) {
        return phaseTemplate.documentationPlan.steps.map((step) => ({
            name: step.name,
            stepType: step.stepType as StepType,
            order: step.order,
            metadata: step.metadata,
        }));
    }

    // Generate default steps if we have required documents but no explicit steps
    const steps: Array<{
        name: string;
        description?: string;
        stepType: StepType;
        order: number;
        metadata?: any;
        requiredDocuments?: Array<{
            documentType: string;
            isRequired: boolean;
        }>;
    }> = [];

    if (phaseTemplate.requiredDocuments && phaseTemplate.requiredDocuments.length > 0) {
        steps.push({
            name: 'Document Upload',
            stepType: 'UPLOAD' as StepType,
            order: 0,
            requiredDocuments: phaseTemplate.requiredDocuments,
        });
        steps.push({
            name: 'Document Review',
            stepType: 'REVIEW' as StepType,
            order: 1,
        });
        steps.push({
            name: 'Final Approval',
            stepType: 'APPROVAL' as StepType,
            order: 2,
        });
    }

    return steps;
}

/**
 * Simple state machine for application states
 */
function getNextState(currentState: ApplicationStatus, trigger: string): ApplicationStatus | null {
    const transitions: Record<ApplicationStatus, Record<string, ApplicationStatus>> = {
        DRAFT: {
            SUBMIT: 'PENDING' as ApplicationStatus,
            CANCEL: 'CANCELLED' as ApplicationStatus,
        },
        PENDING: {
            APPROVE: 'ACTIVE' as ApplicationStatus,
            REJECT: 'CANCELLED' as ApplicationStatus,
            CANCEL: 'CANCELLED' as ApplicationStatus,
        },
        ACTIVE: {
            COMPLETE: 'COMPLETED' as ApplicationStatus,
            TERMINATE: 'TERMINATED' as ApplicationStatus,
            TRANSFER: 'TRANSFERRED' as ApplicationStatus,
            SUPERSEDE: 'SUPERSEDED' as ApplicationStatus, // Another buyer locked the unit
        },
        COMPLETED: {},
        CANCELLED: {},
        TERMINATED: {},
        TRANSFERRED: {},
        SUPERSEDED: {
            // Superseded applications can be transferred to different unit or cancelled
            TRANSFER: 'TRANSFERRED' as ApplicationStatus,
            CANCEL: 'CANCELLED' as ApplicationStatus,
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
    }): Promise<any[]>;
    findById(id: string): Promise<any>;
    findByApplicationNumber(applicationNumber: string): Promise<any>;
    update(id: string, data: UpdateApplicationInput, userId: string): Promise<any>;
    transition(id: string, data: TransitionApplicationInput, userId: string): Promise<any>;
    sign(id: string, userId: string): Promise<any>;
    cancel(id: string, userId: string, reason?: string): Promise<any>;
    delete(id: string, userId: string): Promise<{ success: boolean }>;
    getCurrentAction(id: string): Promise<any>;
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

            for (const phaseTemplate of method.phases) {
                let phaseAmount: number | null = null;
                if (phaseTemplate.percentOfPrice) {
                    phaseAmount = (totalAmount * phaseTemplate.percentOfPrice) / 100;
                } else if (phaseTemplate.phaseCategory === 'DOCUMENTATION' || phaseTemplate.phaseCategory === 'QUESTIONNAIRE') {
                    phaseAmount = 0; // Non-payment phases have no monetary amount
                }

                // Get step definitions and required documents from child tables
                const steps = parseStepDefinitions(phaseTemplate);
                const requiredDocs = phaseTemplate.requiredDocuments || [];

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

                    // Create QuestionnaireField records from plan questions
                    for (const question of questions) {
                        await tx.questionnaireField.create({
                            data: {
                                tenantId: (data as any).tenantId,
                                questionnairePhaseId: questionnairePhase.id,
                                fieldKey: question.questionKey,
                                fieldType: question.questionType,
                                label: question.questionText,
                                helpText: question.helpText,
                                order: question.order,
                                isRequired: question.isRequired ?? true,
                                validationRules: question.validationRules,
                                options: question.options,
                            },
                        });
                    }
                } else if (phaseTemplate.phaseCategory === 'DOCUMENTATION') {
                    // Create DocumentationPhase extension
                    const documentationPhase = await tx.documentationPhase.create({
                        data: {
                            tenantId: (data as any).tenantId,
                            phaseId: phase.id,
                            documentationPlanId: phaseTemplate.documentationPlanId,
                            totalStepsCount: steps.length,
                            completedStepsCount: 0,
                            requiredDocumentsCount: requiredDocs.filter((d: any) => d.isRequired).length,
                            approvedDocumentsCount: 0,
                            minimumCompletionPercentage: phaseTemplate.minimumCompletionPercentage,
                            stepDefinitionsSnapshot: phaseTemplate.stepDefinitionsSnapshot,
                            requiredDocumentSnapshot: phaseTemplate.requiredDocumentSnapshot,
                        },
                    });

                    // Create DocumentationStep records
                    for (const step of steps) {
                        const createdStep = await tx.documentationStep.create({
                            data: {
                                tenantId: (data as any).tenantId,
                                documentationPhaseId: documentationPhase.id,
                                name: step.name,
                                description: step.description,
                                stepType: step.stepType as StepType,
                                order: step.order,
                                status: 'PENDING' as StepStatus,
                                metadata: step.metadata ?? null,
                            },
                        });

                        // Create required document records for this step (if any)
                        if (step.requiredDocuments && step.requiredDocuments.length > 0) {
                            for (const doc of step.requiredDocuments) {
                                await tx.documentationStepDocument.create({
                                    data: {
                                        tenantId: (data as any).tenantId,
                                        stepId: createdStep.id,
                                        documentType: doc.documentType,
                                        isRequired: doc.isRequired ?? true,
                                    },
                                });
                            }
                        }
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
    }) {
        const applications = await prisma.application.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
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
        });
        return applications;
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
                                steps: {
                                    orderBy: { order: 'asc' },
                                    include: {
                                        requiredDocuments: true,
                                        approvals: {
                                            orderBy: { decidedAt: 'desc' },
                                            take: 1,
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

    /**
     * Get the current action required for a application
     * Returns the current phase, current step, required action, and relevant documents
     * This is the canonical endpoint for the app to know what to show the user
     */
    async function getCurrentAction(id: string): Promise<{
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
            createdAt: Date;
        }>;
        actionRequired: 'NONE' | 'UPLOAD' | 'RESUBMIT' | 'SIGN' | 'WAIT_FOR_REVIEW' | 'PAYMENT' | 'COMPLETE';
        actionMessage: string;
    }> {
        // Use any to avoid Prisma type issues with new relations
        const application: any = await prisma.application.findUnique({
            where: { id },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        documentationPhase: {
                            include: {
                                steps: {
                                    orderBy: { order: 'asc' },
                                    include: {
                                        requiredDocuments: true,
                                        approvals: {
                                            orderBy: { decidedAt: 'desc' },
                                            take: 1,
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
            },
        });

        if (!application) {
            throw new AppError(404, 'application not found');
        }

        // Find current phase (IN_PROGRESS or ACTIVE)
        const currentPhase = application.phases.find(
            (p: any) => p.status === 'IN_PROGRESS' || p.status === 'ACTIVE' || p.status === 'AWAITING_APPROVAL'
        );

        // If no active phase, check application status
        if (!currentPhase) {
            return {
                applicationId: application.id,
                applicationStatus: application.status,
                currentPhase: null,
                currentStep: null,
                uploadedDocuments: application.documents.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    status: d.status,
                    stepId: d.stepId,
                    createdAt: d.createdAt,
                })),
                actionRequired: application.status === 'COMPLETED' ? 'COMPLETE' : 'NONE',
                actionMessage: application.status === 'COMPLETED'
                    ? 'Application completed successfully'
                    : 'No action required at this time',
            };
        }

        // Find current step - only for DOCUMENTATION phases
        // Steps are now in documentationPhase extension
        let currentStep: any = null;
        const steps = currentPhase.documentationPhase?.steps || [];
        const currentStepId = currentPhase.documentationPhase?.currentStepId;

        if (currentStepId) {
            currentStep = steps.find((s: any) => s.id === currentStepId);
        }
        if (!currentStep && steps.length > 0) {
            // Fallback: find next actionable step
            currentStep = steps.find(
                (s: any) => s.status === 'NEEDS_RESUBMISSION' || s.status === 'ACTION_REQUIRED'
            );
            if (!currentStep) {
                currentStep = steps.find(
                    (s: any) => s.status === 'PENDING' || s.status === 'IN_PROGRESS' || s.status === 'AWAITING_REVIEW'
                );
            }
        }

        // Determine action required based on step status
        let actionRequired: 'NONE' | 'UPLOAD' | 'RESUBMIT' | 'SIGN' | 'WAIT_FOR_REVIEW' | 'PAYMENT' | 'COMPLETE' = 'NONE';
        let actionMessage = 'No action required';

        if (currentPhase.phaseCategory === 'PAYMENT') {
            actionRequired = 'PAYMENT';
            actionMessage = 'Payment is required for this phase';
        } else if (currentStep) {
            switch (currentStep.status) {
                case 'NEEDS_RESUBMISSION':
                    actionRequired = 'RESUBMIT';
                    actionMessage = currentStep.actionReason || 'Please resubmit the required documents';
                    break;
                case 'ACTION_REQUIRED':
                    actionRequired = 'UPLOAD';
                    actionMessage = currentStep.actionReason || 'Please address the requested changes';
                    break;
                case 'PENDING':
                case 'IN_PROGRESS':
                    if (currentStep.stepType === 'UPLOAD') {
                        actionRequired = 'UPLOAD';
                        actionMessage = `Please upload the required documents for: ${currentStep.name}`;
                    } else if (currentStep.stepType === 'SIGNATURE') {
                        actionRequired = 'SIGN';
                        actionMessage = 'Please sign the document';
                    } else if (currentStep.stepType === 'PRE_APPROVAL') {
                        actionRequired = 'UPLOAD';
                        actionMessage = 'Please complete the pre-approval questionnaire';
                    } else {
                        actionRequired = 'WAIT_FOR_REVIEW';
                        actionMessage = 'Your submission is being processed';
                    }
                    break;
                case 'AWAITING_REVIEW':
                    actionRequired = 'WAIT_FOR_REVIEW';
                    actionMessage = 'Your submission is under review';
                    break;
                default:
                    break;
            }
        }

        // Get documents for this phase
        const phaseDocuments = application.documents.filter(
            (d: any) => d.phaseId === currentPhase.id
        );

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
                    })),
                    latestApproval: currentStep.approvals[0]
                        ? {
                            decision: currentStep.approvals[0].decision,
                            comment: currentStep.approvals[0].comment,
                            decidedAt: currentStep.approvals[0].decidedAt,
                        }
                        : null,
                }
                : null,
            uploadedDocuments: phaseDocuments.map((d: any) => ({
                id: d.id,
                name: d.name,
                type: d.type,
                status: d.status,
                stepId: d.stepId,
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
