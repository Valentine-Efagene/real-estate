import { prisma } from '../lib/prisma.js';
import { AppError } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';
import type {
    CreateContractInput,
    UpdateContractInput,
    TransitionContractInput,
} from '../validators/contract.validator.js';
import { paymentMethodService } from './payment-method.service.js';

class ContractService {
    /**
     * Generate a unique contract number
     */
    private generateContractNumber(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `CTR-${timestamp}-${random}`;
    }

    /**
     * Calculate monthly payment using standard amortization formula
     */
    private calculatePeriodicPayment(
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
     * Create a contract from a payment method
     * Instantiates phases from the method's phase templates
     */
    async create(data: CreateContractInput) {
        // Load payment method with phases
        const method = await paymentMethodService.findById(data.paymentMethodId);

        if (!method.isActive) {
            throw new AppError(400, 'Payment method is not active');
        }

        if (method.phases.length === 0) {
            throw new AppError(400, 'Payment method has no phases configured');
        }

        // Verify property unit exists and is available
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

        // Verify buyer exists
        const buyer = await prisma.user.findUnique({
            where: { id: data.buyerId },
        });

        if (!buyer) {
            throw new AppError(404, 'Buyer not found');
        }

        // Calculate financial details - use unit price (with override) or provided amount
        const unitPrice = propertyUnit.priceOverride ?? propertyUnit.variant.price;
        const totalAmount = data.totalAmount ?? unitPrice;
        const downPayment = data.downPayment ?? 0;
        const principal = totalAmount - downPayment;
        const interestRate = data.interestRate ?? 0;
        const termMonths = data.termMonths;

        let periodicPayment: number | null = null;
        if (termMonths && principal > 0) {
            periodicPayment = this.calculatePeriodicPayment(principal, interestRate, termMonths);
        }

        const contract = await prisma.$transaction(async (tx) => {
            // Reserve the unit
            await tx.propertyUnit.update({
                where: { id: data.propertyUnitId },
                data: {
                    status: 'RESERVED',
                    reservedAt: new Date(),
                    reservedById: data.buyerId,
                },
            });

            // Update variant inventory counters
            await tx.propertyVariant.update({
                where: { id: propertyUnit.variantId },
                data: {
                    availableUnits: { decrement: 1 },
                    reservedUnits: { increment: 1 },
                },
            });

            // Create the contract
            const created = await tx.contract.create({
                data: {
                    propertyUnitId: data.propertyUnitId,
                    buyerId: data.buyerId,
                    sellerId: data.sellerId ?? propertyUnit.variant.property.userId,
                    paymentMethodId: data.paymentMethodId,
                    contractNumber: this.generateContractNumber(),
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

            // Instantiate phases from method templates
            for (const phaseTemplate of method.phases) {
                // Calculate phase amount based on percentOfPrice
                let phaseAmount: number | null = null;
                if (phaseTemplate.percentOfPrice) {
                    phaseAmount = (totalAmount * phaseTemplate.percentOfPrice) / 100;
                }

                const phase = await tx.contractPhase.create({
                    data: {
                        contractId: created.id,
                        paymentPlanId: phaseTemplate.paymentPlanId,
                        name: phaseTemplate.name,
                        description: phaseTemplate.description,
                        phaseCategory: phaseTemplate.phaseCategory,
                        phaseType: phaseTemplate.phaseType,
                        order: phaseTemplate.order,
                        status: 'PENDING',
                        totalAmount: phaseAmount,
                        remainingAmount: phaseAmount,
                        interestRate: phaseTemplate.interestRate,
                        requiresPreviousPhaseCompletion: phaseTemplate.requiresPreviousPhaseCompletion,
                        minimumCompletionPercentage: phaseTemplate.minimumCompletionPercentage,
                    },
                });

                // For DOCUMENTATION phases, create steps from template
                if (phaseTemplate.phaseCategory === 'DOCUMENTATION') {
                    const steps = this.parseStepDefinitions(phaseTemplate);
                    for (const step of steps) {
                        await tx.contractPhaseStep.create({
                            data: {
                                phaseId: phase.id,
                                name: step.name,
                                description: step.description,
                                stepType: step.stepType,
                                order: step.order,
                                status: 'PENDING',
                                requiredDocumentTypes: step.requiredDocumentTypes,
                            },
                        });
                    }
                }
            }

            // Write domain event
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

            return created;
        });

        return this.findById(contract.id);
    }

    /**
     * Parse step definitions from phase template
     */
    private parseStepDefinitions(phaseTemplate: {
        requiredDocumentTypes: string | null;
        stepDefinitions: string | null;
    }): Array<{
        name: string;
        description?: string;
        stepType: string;
        order: number;
        requiredDocumentTypes?: string;
    }> {
        // If stepDefinitions is provided as JSON, parse it
        if (phaseTemplate.stepDefinitions) {
            try {
                return JSON.parse(phaseTemplate.stepDefinitions);
            } catch {
                // Fall through to default generation
            }
        }

        // Generate default steps from requiredDocumentTypes
        const steps: Array<{
            name: string;
            description?: string;
            stepType: string;
            order: number;
            requiredDocumentTypes?: string;
        }> = [];

        if (phaseTemplate.requiredDocumentTypes) {
            // Upload step
            steps.push({
                name: 'Document Upload',
                stepType: 'UPLOAD',
                order: 0,
                requiredDocumentTypes: phaseTemplate.requiredDocumentTypes,
            });

            // Review step
            steps.push({
                name: 'Document Review',
                stepType: 'REVIEW',
                order: 1,
            });

            // Approval step
            steps.push({
                name: 'Final Approval',
                stepType: 'APPROVAL',
                order: 2,
            });
        }

        return steps;
    }

    async findAll(filters?: {
        buyerId?: string;
        propertyUnitId?: string;
        status?: string;
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

    async findById(id: string) {
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

    async findByContractNumber(contractNumber: string) {
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

    async update(id: string, data: UpdateContractInput, userId: string) {
        const contract = await this.findById(id);

        // Check authorization (buyer or seller can update)
        if (contract.buyerId !== userId && contract.sellerId !== userId) {
            throw new AppError(403, 'Unauthorized to update this contract');
        }

        const updated = await prisma.contract.update({
            where: { id },
            data,
        });

        return this.findById(updated.id);
    }

    async transition(id: string, data: TransitionContractInput, userId: string) {
        const contract = await this.findById(id);

        const fromState = contract.state;
        const toState = this.getNextState(fromState, data.trigger);

        if (!toState) {
            throw new AppError(400, `Invalid transition: ${data.trigger} from state ${fromState}`);
        }

        const updated = await prisma.$transaction(async (tx) => {
            // Update contract state
            const result = await tx.contract.update({
                where: { id },
                data: {
                    state: toState,
                    status: this.mapStateToStatus(toState),
                },
            });

            // Record transition
            await tx.contractTransition.create({
                data: {
                    contractId: id,
                    fromState,
                    toState,
                    trigger: data.trigger,
                    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
                },
            });

            // Write domain event
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

        return this.findById(updated.id);
    }

    /**
     * Simple state machine for contract states
     */
    private getNextState(currentState: string, trigger: string): string | null {
        const transitions: Record<string, Record<string, string>> = {
            DRAFT: {
                SUBMIT: 'PENDING',
                CANCEL: 'CANCELLED',
            },
            PENDING: {
                APPROVE: 'ACTIVE',
                REJECT: 'CANCELLED',
                CANCEL: 'CANCELLED',
            },
            ACTIVE: {
                COMPLETE: 'COMPLETED',
                TERMINATE: 'TERMINATED',
            },
        };

        return transitions[currentState]?.[trigger] ?? null;
    }

    private mapStateToStatus(state: string): string {
        const mapping: Record<string, string> = {
            DRAFT: 'DRAFT',
            PENDING: 'PENDING',
            ACTIVE: 'ACTIVE',
            COMPLETED: 'COMPLETED',
            CANCELLED: 'CANCELLED',
            TERMINATED: 'TERMINATED',
        };
        return mapping[state] ?? state;
    }

    async sign(id: string, userId: string) {
        const contract = await this.findById(id);

        if (contract.signedAt) {
            throw new AppError(400, 'Contract already signed');
        }

        if (contract.buyerId !== userId) {
            throw new AppError(403, 'Only the buyer can sign the contract');
        }

        const updated = await prisma.contract.update({
            where: { id },
            data: {
                signedAt: new Date(),
                status: 'ACTIVE',
                state: 'ACTIVE',
            },
        });

        return this.findById(updated.id);
    }

    async cancel(id: string, userId: string, reason?: string) {
        const contract = await this.findById(id);

        if (contract.status === 'COMPLETED' || contract.status === 'CANCELLED') {
            throw new AppError(400, `Cannot cancel contract in ${contract.status} status`);
        }

        const updated = await prisma.$transaction(async (tx) => {
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

        return this.findById(updated.id);
    }

    async delete(id: string, userId: string) {
        const contract = await this.findById(id);

        if (contract.status !== 'DRAFT') {
            throw new AppError(400, 'Only draft contracts can be deleted');
        }

        if (contract.buyerId !== userId) {
            throw new AppError(403, 'Only the buyer can delete the contract');
        }

        await prisma.$transaction(async (tx) => {
            // Delete in order of dependencies
            await tx.contractPayment.deleteMany({ where: { contractId: id } });
            await tx.contractDocument.deleteMany({ where: { contractId: id } });

            // Delete phase-related data
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
}

export const contractService = new ContractService();
