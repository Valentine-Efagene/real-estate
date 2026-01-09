import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient, StepType, ContractStatus, PhaseStatus, StepStatus } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    CreateContractInput,
    UpdateContractInput,
    TransitionContractInput,
} from '../validators/contract.validator';
import { createPaymentMethodService } from './payment-method.service';
import {
    sendContractCreatedNotification,
    sendContractActivatedNotification,
    formatCurrency,
    formatDate,
} from '../lib/notifications';

type AnyPrismaClient = PrismaClient;

// Dashboard URL base
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.contribuild.com';

/**
 * Generate a unique contract number
 */
function generateContractNumber(): string {
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
 * Extract mortgage payment info from contract phases
 * The mortgage phase has a payment plan with term and interest rate
 * Now reads from PaymentPhase extension table
 */
function getMortgagePaymentInfo(contract: any): { termMonths: number; monthlyPayment: number } {
    // Find the mortgage phase (phaseType = 'MORTGAGE')
    const mortgagePhase = contract.phases?.find(
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
 * Now reads from the child table `steps` instead of JSON string
 */
function parseStepDefinitions(phaseTemplate: {
    steps?: Array<{
        name: string;
        stepType: StepType;
        order: number;
        metadata?: any;
    }>;
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
    // If we have normalized steps, use them
    if (phaseTemplate.steps && phaseTemplate.steps.length > 0) {
        return phaseTemplate.steps.map((step, idx) => ({
            name: step.name,
            stepType: step.stepType,
            order: step.order,
            metadata: step.metadata, // Include metadata for GENERATE_DOCUMENT steps
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
 * Simple state machine for contract states
 */
function getNextState(currentState: ContractStatus, trigger: string): ContractStatus | null {
    const transitions: Record<ContractStatus, Record<string, ContractStatus>> = {
        DRAFT: {
            SUBMIT: 'PENDING' as ContractStatus,
            CANCEL: 'CANCELLED' as ContractStatus,
        },
        PENDING: {
            APPROVE: 'ACTIVE' as ContractStatus,
            REJECT: 'CANCELLED' as ContractStatus,
            CANCEL: 'CANCELLED' as ContractStatus,
        },
        ACTIVE: {
            COMPLETE: 'COMPLETED' as ContractStatus,
            TERMINATE: 'TERMINATED' as ContractStatus,
            TRANSFER: 'TRANSFERRED' as ContractStatus,
        },
        COMPLETED: {},
        CANCELLED: {},
        TERMINATED: {},
        TRANSFERRED: {},
    };

    return transitions[currentState]?.[trigger] ?? null;
}

function mapStateToStatus(state: ContractStatus): ContractStatus {
    // State and status are now the same type
    return state;
}

/**
 * Contract service interface
 */
export interface ContractService {
    create(data: CreateContractInput): Promise<any>;
    findAll(filters?: {
        buyerId?: string;
        propertyUnitId?: string;
        status?: ContractStatus;
    }): Promise<any[]>;
    findById(id: string): Promise<any>;
    findByContractNumber(contractNumber: string): Promise<any>;
    update(id: string, data: UpdateContractInput, userId: string): Promise<any>;
    transition(id: string, data: TransitionContractInput, userId: string): Promise<any>;
    sign(id: string, userId: string): Promise<any>;
    cancel(id: string, userId: string, reason?: string): Promise<any>;
    delete(id: string, userId: string): Promise<{ success: boolean }>;
    getCurrentAction(id: string): Promise<any>;
}

/**
 * Create a contract service with the given Prisma client
 * Use this for tenant-scoped operations
 */
export function createContractService(prisma: AnyPrismaClient = defaultPrisma): ContractService {
    const paymentMethodService = createPaymentMethodService(prisma);

    async function create(data: CreateContractInput): Promise<any> {
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

        const contract = await prisma.$transaction(async (tx: any) => {
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

            const created = await tx.contract.create({
                data: {
                    tenantId: (data as any).tenantId,
                    propertyUnitId: data.propertyUnitId,
                    buyerId: data.buyerId,
                    sellerId: data.sellerId ?? propertyUnit.variant.property.userId,
                    paymentMethodId: data.paymentMethodId,
                    contractNumber: generateContractNumber(),
                    title: data.title,
                    description: data.description,
                    contractType: data.contractType,
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

                // Create base ContractPhase (shared fields only)
                const phase = await tx.contractPhase.create({
                    data: {
                        contractId: created.id,
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
                    // Create QuestionnairePhase extension
                    const questionnairePhase = await tx.questionnairePhase.create({
                        data: {
                            phaseId: phase.id,
                            totalFieldsCount: 0, // Will be populated when fields are defined
                            completedFieldsCount: 0,
                            fieldsSnapshot: phaseTemplate.stepDefinitionsSnapshot,
                        },
                    });

                    // TODO: Create QuestionnaireField records if template has field definitions
                } else if (phaseTemplate.phaseCategory === 'DOCUMENTATION') {
                    // Create DocumentationPhase extension
                    const documentationPhase = await tx.documentationPhase.create({
                        data: {
                            phaseId: phase.id,
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
                                        stepId: createdStep.id,
                                        documentType: doc.documentType,
                                        isRequired: doc.isRequired ?? true,
                                    },
                                });
                            }
                        }
                    }
                } else if (phaseTemplate.phaseCategory === 'PAYMENT') {
                    // Create PaymentPhase extension
                    await tx.paymentPhase.create({
                        data: {
                            phaseId: phase.id,
                            paymentPlanId: phaseTemplate.paymentPlanId,
                            totalAmount: phaseAmount ?? 0,
                            paidAmount: 0,
                            interestRate: phaseTemplate.interestRate ?? 0,
                            collectFunds: phaseTemplate.collectFunds ?? phaseTemplate.paymentPlan?.collectFunds ?? true,
                            minimumCompletionPercentage: phaseTemplate.minimumCompletionPercentage,
                            paymentPlanSnapshot: phaseTemplate.paymentPlan ? JSON.parse(JSON.stringify(phaseTemplate.paymentPlan)) : null,
                        },
                    });
                }
            }

            // Audit trail (permanent record)
            await tx.contractEvent.create({
                data: {
                    contractId: created.id,
                    eventType: 'CONTRACT_CREATED',
                    eventGroup: 'STATE_CHANGE',
                    data: {
                        contractNumber: created.contractNumber,
                        buyerId: data.buyerId,
                        propertyUnitId: data.propertyUnitId,
                        totalAmount,
                        contractType: data.contractType,
                    },
                    actorId: data.buyerId,
                    actorType: 'USER',
                },
            });

            // Inter-service communication (triggers notifications)
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.CREATED',
                    aggregateType: 'Contract',
                    aggregateId: created.id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId: created.id,
                        contractNumber: created.contractNumber,
                        buyerId: data.buyerId,
                        propertyUnitId: data.propertyUnitId,
                        totalAmount,
                    }),
                    actorId: data.buyerId,
                },
            });

            return created;
        });

        const fullContract = await findById(contract.id);

        // Send contract created notification
        try {
            // Get mortgage payment info from phases
            const mortgageInfo = getMortgagePaymentInfo(fullContract);

            await sendContractCreatedNotification({
                email: buyer.email,
                userName: buyer.firstName || 'Valued Customer',
                contractNumber: fullContract.contractNumber,
                propertyName: propertyUnit.variant?.property?.title || 'Your Property',
                totalAmount: formatCurrency(totalAmount),
                termMonths: mortgageInfo.termMonths,
                monthlyPayment: formatCurrency(mortgageInfo.monthlyPayment),
                dashboardUrl: `${DASHBOARD_URL}/contracts/${contract.id}`,
            }, contract.id);
        } catch (error) {
            console.error('[Contract] Failed to send created notification', { id: contract.id, error });
        }

        return fullContract;
    }

    async function findAll(filters?: {
        buyerId?: string;
        propertyUnitId?: string;
        status?: ContractStatus;
    }) {
        const contracts = await prisma.contract.findMany({
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
        return contracts;
    }

    async function findById(id: string): Promise<any> {
        const contract = await prisma.contract.findUnique({
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

        if (!contract) {
            throw new AppError(404, 'Contract not found');
        }

        return contract;
    }

    async function findByContractNumber(contractNumber: string) {
        const contract = await prisma.contract.findUnique({
            where: { contractNumber },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!contract) {
            throw new AppError(404, 'Contract not found');
        }

        return contract;
    }

    async function update(id: string, data: UpdateContractInput, userId: string) {
        const contract = await findById(id);

        if (contract.buyerId !== userId && contract.sellerId !== userId) {
            throw new AppError(403, 'Unauthorized to update this contract');
        }

        const updated = await prisma.contract.update({
            where: { id },
            data,
        });

        return findById(updated.id);
    }

    async function transition(id: string, data: TransitionContractInput, userId: string) {
        const contract = await findById(id);

        const fromStatus = contract.status;
        const toStatus = getNextState(fromStatus, data.trigger);

        if (!toStatus) {
            throw new AppError(400, `Invalid transition: ${data.trigger} from status ${fromStatus}`);
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const result = await tx.contract.update({
                where: { id },
                data: {
                    status: toStatus,
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.STATE_CHANGED',
                    aggregateType: 'Contract',
                    aggregateId: id,
                    queueName: 'contract-steps',
                    payload: JSON.stringify({
                        contractId: id,
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
        const contract = await findById(id);

        if (contract.signedAt) {
            throw new AppError(400, 'Contract already signed');
        }

        if (contract.buyerId !== userId) {
            throw new AppError(403, 'Only the buyer can sign the contract');
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const result = await tx.contract.update({
                where: { id },
                data: {
                    signedAt: new Date(),
                    status: 'ACTIVE',
                },
            });

            // Write CONTRACT.SIGNED domain event
            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.SIGNED',
                    aggregateType: 'Contract',
                    aggregateId: id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId: id,
                        buyerId: contract.buyerId,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        const activatedContract = await findById(updated.id);

        // Send contract activated notification
        try {
            // Find next payment due date from first payment phase's installments
            const firstPaymentPhase = activatedContract.phases?.find(
                (p: any) => p.phaseCategory === 'PAYMENT' && p.paymentPhase?.installments?.length > 0
            );
            const firstInstallment = firstPaymentPhase?.paymentPhase?.installments?.[0];
            const nextPaymentDate = firstInstallment?.dueDate
                ? formatDate(firstInstallment.dueDate)
                : 'To be scheduled';

            // Get mortgage payment info from phases
            const mortgageInfo = getMortgagePaymentInfo(activatedContract);

            await sendContractActivatedNotification({
                email: contract.buyer?.email || '',
                userName: contract.buyer?.firstName || 'Valued Customer',
                contractNumber: contract.contractNumber,
                propertyName: contract.propertyUnit?.variant?.property?.title || 'Your Property',
                startDate: formatDate(new Date()),
                nextPaymentDate,
                monthlyPayment: formatCurrency(mortgageInfo.monthlyPayment || 0),
                dashboardUrl: `${DASHBOARD_URL}/contracts/${id}`,
            }, id);
        } catch (error) {
            console.error('[Contract] Failed to send activated notification', { id, error });
        }

        return activatedContract;
    }

    async function cancel(id: string, userId: string, reason?: string) {
        const contract = await findById(id);

        if (contract.status === 'COMPLETED' || contract.status === 'CANCELLED') {
            throw new AppError(400, `Cannot cancel contract in ${contract.status} status`);
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const result = await tx.contract.update({
                where: { id },
                data: {
                    status: 'CANCELLED',
                    terminatedAt: new Date(),
                },
            });

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.CANCELLED',
                    aggregateType: 'Contract',
                    aggregateId: id,
                    queueName: 'notifications',
                    payload: JSON.stringify({
                        contractId: id,
                        buyerId: contract.buyerId,
                        reason,
                    }),
                    actorId: userId,
                },
            });

            return result;
        });

        return findById(updated.id);
    }

    async function deleteContract(id: string, userId: string) {
        const contract = await findById(id);

        if (contract.status !== 'DRAFT') {
            throw new AppError(400, 'Only draft contracts can be deleted');
        }

        if (contract.buyerId !== userId) {
            throw new AppError(403, 'Only the buyer can delete the contract');
        }

        await prisma.$transaction(async (tx: any) => {
            await tx.contractPayment.deleteMany({ where: { contractId: id } });
            await tx.contractDocument.deleteMany({ where: { contractId: id } });

            const phases = await tx.contractPhase.findMany({
                where: { contractId: id },
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
                    await tx.contractInstallment.deleteMany({ where: { paymentPhaseId: payPhaseId } });
                    await tx.paymentPhase.delete({ where: { id: payPhaseId } });
                }

                // Delete QuestionnairePhase extension and children
                if (phase.questionnairePhase) {
                    const questPhaseId = phase.questionnairePhase.id;
                    await tx.questionnaireField.deleteMany({ where: { questionnairePhaseId: questPhaseId } });
                    await tx.questionnairePhase.delete({ where: { id: questPhaseId } });
                }
            }

            await tx.contractPhase.deleteMany({ where: { contractId: id } });
            await tx.contractEvent.deleteMany({ where: { contractId: id } });
            await tx.contract.delete({ where: { id } });
        });

        return { success: true };
    }

    /**
     * Get the current action required for a contract
     * Returns the current phase, current step, required action, and relevant documents
     * This is the canonical endpoint for the app to know what to show the user
     */
    async function getCurrentAction(id: string): Promise<{
        contractId: string;
        contractStatus: ContractStatus;
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
        const contract: any = await prisma.contract.findUnique({
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

        if (!contract) {
            throw new AppError(404, 'Contract not found');
        }

        // Find current phase (IN_PROGRESS or ACTIVE)
        const currentPhase = contract.phases.find(
            (p: any) => p.status === 'IN_PROGRESS' || p.status === 'ACTIVE' || p.status === 'AWAITING_APPROVAL'
        );

        // If no active phase, check contract status
        if (!currentPhase) {
            return {
                contractId: contract.id,
                contractStatus: contract.status,
                currentPhase: null,
                currentStep: null,
                uploadedDocuments: contract.documents.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    status: d.status,
                    stepId: d.stepId,
                    createdAt: d.createdAt,
                })),
                actionRequired: contract.status === 'COMPLETED' ? 'COMPLETE' : 'NONE',
                actionMessage: contract.status === 'COMPLETED'
                    ? 'Contract completed successfully'
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
        const phaseDocuments = contract.documents.filter(
            (d: any) => d.phaseId === currentPhase.id
        );

        return {
            contractId: contract.id,
            contractStatus: contract.status,
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
        findByContractNumber,
        update,
        transition,
        sign,
        cancel,
        delete: deleteContract,
        getCurrentAction,
    };
}

// Default instance for backward compatibility
export const contractService: ContractService = createContractService();
