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
        }));
    }

    // Generate default steps if we have required documents but no explicit steps
    const steps: Array<{
        name: string;
        description?: string;
        stepType: StepType;
        order: number;
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
        },
        COMPLETED: {},
        CANCELLED: {},
        TERMINATED: {},
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
        const downPayment = data.downPayment ?? 0;
        const principal = totalAmount - downPayment;
        const interestRate = data.interestRate ?? 0;
        const termMonths = data.termMonths;

        let periodicPayment: number | null = null;
        if (termMonths && principal > 0) {
            periodicPayment = calculatePeriodicPayment(principal, interestRate, termMonths);
        }

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
                    downPayment,
                    principal,
                    interestRate,
                    termMonths,
                    periodicPayment,
                    status: 'DRAFT',
                    state: 'DRAFT',
                    startDate: data.startDate ? new Date(data.startDate) : null,
                },
            });

            for (const phaseTemplate of method.phases) {
                let phaseAmount: number | null = null;
                if (phaseTemplate.percentOfPrice) {
                    phaseAmount = (totalAmount * phaseTemplate.percentOfPrice) / 100;
                } else if (phaseTemplate.phaseCategory === 'DOCUMENTATION') {
                    phaseAmount = 0; // Documentation phases have no monetary amount
                }

                // Get step definitions and required documents from child tables
                const steps = parseStepDefinitions(phaseTemplate);
                const requiredDocs = phaseTemplate.requiredDocuments || [];

                const phase = await tx.contractPhase.create({
                    data: {
                        contractId: created.id,
                        paymentPlanId: phaseTemplate.paymentPlanId,
                        name: phaseTemplate.name,
                        description: phaseTemplate.description,
                        phaseCategory: phaseTemplate.phaseCategory,
                        phaseType: phaseTemplate.phaseType,
                        order: phaseTemplate.order,
                        status: 'PENDING' as PhaseStatus,
                        totalAmount: phaseAmount,
                        remainingAmount: phaseAmount,
                        interestRate: phaseTemplate.interestRate,
                        // Determine collectFunds: phase override > paymentPlan setting > default true
                        collectFunds: phaseTemplate.collectFunds ?? phaseTemplate.paymentPlan?.collectFunds ?? true,
                        requiresPreviousPhaseCompletion: phaseTemplate.requiresPreviousPhaseCompletion,
                        minimumCompletionPercentage: phaseTemplate.minimumCompletionPercentage,
                        // Store snapshots for audit
                        stepDefinitionsSnapshot: phaseTemplate.stepDefinitionsSnapshot,
                        requiredDocumentSnapshot: phaseTemplate.requiredDocumentSnapshot,
                        // Initialize progress counters
                        totalStepsCount: steps.length,
                        completedStepsCount: 0,
                        requiredDocumentsCount: requiredDocs.filter((d: any) => d.isRequired).length,
                        approvedDocumentsCount: 0,
                    },
                });

                if (phaseTemplate.phaseCategory === 'DOCUMENTATION') {
                    for (const step of steps) {
                        const createdStep = await tx.contractPhaseStep.create({
                            data: {
                                phaseId: phase.id,
                                name: step.name,
                                description: step.description,
                                stepType: step.stepType as StepType,
                                order: step.order,
                                status: 'PENDING' as StepStatus,
                            },
                        });

                        // Create required document records for this step (if any)
                        if (step.requiredDocuments && step.requiredDocuments.length > 0) {
                            for (const doc of step.requiredDocuments) {
                                await tx.contractPhaseStepDocument.create({
                                    data: {
                                        stepId: createdStep.id,
                                        documentType: doc.documentType,
                                        isRequired: doc.isRequired ?? true,
                                    },
                                });
                            }
                        }
                    }
                }
            }

            await tx.domainEvent.create({
                data: {
                    id: uuidv4(),
                    eventType: 'CONTRACT.CREATED',
                    aggregateType: 'Contract',
                    aggregateId: created.id,
                    queueName: 'contract-steps',
                    payload: JSON.stringify({
                        contractId: created.id,
                        buyerId: data.buyerId,
                        propertyUnitId: data.propertyUnitId,
                        paymentMethodId: data.paymentMethodId,
                    }),
                },
            });

            // Link prequalification to contract if provided
            if ((data as any).prequalificationId) {
                await tx.prequalification.update({
                    where: { id: (data as any).prequalificationId },
                    data: { contractId: created.id },
                });
            }

            return created;
        });

        const fullContract = await findById(contract.id);

        // Send contract created notification
        try {
            await sendContractCreatedNotification({
                email: buyer.email,
                userName: buyer.firstName || 'Valued Customer',
                contractNumber: fullContract.contractNumber,
                propertyName: propertyUnit.variant?.property?.title || 'Your Property',
                totalAmount: formatCurrency(totalAmount),
                termMonths: termMonths || 0,
                monthlyPayment: formatCurrency(periodicPayment || 0),
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
                        paymentPlan: true,
                        steps: {
                            orderBy: { order: 'asc' },
                        },
                        installments: {
                            orderBy: { installmentNumber: 'asc' },
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

        const fromState = contract.state;
        const toState = getNextState(fromState, data.trigger);

        if (!toState) {
            throw new AppError(400, `Invalid transition: ${data.trigger} from state ${fromState}`);
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const result = await tx.contract.update({
                where: { id },
                data: {
                    state: toState,
                    status: mapStateToStatus(toState),
                },
            });

            await tx.contractTransition.create({
                data: {
                    contractId: id,
                    fromState,
                    toState,
                    trigger: data.trigger,
                    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
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
                        fromState,
                        toState,
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
                    state: 'ACTIVE',
                },
            });

            // Record the transition to ACTIVE
            await tx.contractTransition.create({
                data: {
                    contractId: id,
                    fromState: contract.state,
                    toState: 'ACTIVE',
                    trigger: 'SIGN',
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
            // Find next payment due date from first installment
            const firstInstallment = activatedContract.phases?.[0]?.installments?.[0];
            const nextPaymentDate = firstInstallment?.dueDate
                ? formatDate(firstInstallment.dueDate)
                : 'To be scheduled';

            await sendContractActivatedNotification({
                email: contract.buyer?.email || '',
                userName: contract.buyer?.firstName || 'Valued Customer',
                contractNumber: contract.contractNumber,
                propertyName: contract.propertyUnit?.variant?.property?.title || 'Your Property',
                startDate: formatDate(new Date()),
                nextPaymentDate,
                monthlyPayment: formatCurrency(contract.periodicPayment || 0),
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
                    state: 'CANCELLED',
                    terminatedAt: new Date(),
                },
            });

            await tx.contractTransition.create({
                data: {
                    contractId: id,
                    fromState: contract.state,
                    toState: 'CANCELLED',
                    trigger: 'CANCEL',
                    metadata: reason ? JSON.stringify({ reason }) : null,
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

            const phases = await tx.contractPhase.findMany({ where: { contractId: id } });
            for (const phase of phases) {
                await tx.contractPhaseStepApproval.deleteMany({
                    where: { step: { phaseId: phase.id } },
                });
                await tx.contractPhaseStep.deleteMany({ where: { phaseId: phase.id } });
                await tx.contractInstallment.deleteMany({ where: { phaseId: phase.id } });
            }

            await tx.contractPhase.deleteMany({ where: { contractId: id } });
            await tx.contractTransition.deleteMany({ where: { contractId: id } });
            await tx.contractEvent.deleteMany({ where: { contractId: id } });
            await tx.contract.delete({ where: { id } });
        });

        return { success: true };
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
    };
}

// Default instance for backward compatibility
export const contractService: ContractService = createContractService();
