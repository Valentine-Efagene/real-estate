import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient, PhaseType, StepType } from '@valentine-efagene/qshelter-common';
import type {
    CreatePaymentMethodInput,
    UpdatePaymentMethodInput,
    AddPhaseInput,
    LinkToPropertyInput,
} from '../validators/payment-method.validator';

type AnyPrismaClient = PrismaClient;

/** Service interface to avoid non-portable inferred types */
export interface PaymentMethodService {
    create(tenantId: string, data: CreatePaymentMethodInput): Promise<any>;
    findAll(filters?: { isActive?: boolean }): Promise<any[]>;
    findById(id: string): Promise<any>;
    update(id: string, data: UpdatePaymentMethodInput): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    addPhase(methodId: string, data: AddPhaseInput): Promise<any>;
    updatePhase(phaseId: string, data: Partial<AddPhaseInput>): Promise<any>;
    deletePhase(phaseId: string): Promise<{ success: boolean }>;
    reorderPhases(methodId: string, phaseOrders: { phaseId: string; order: number }[]): Promise<any>;
    linkToProperty(methodId: string, data: LinkToPropertyInput): Promise<any>;
    unlinkFromProperty(methodId: string, propertyId: string): Promise<{ success: boolean }>;
    getMethodsForProperty(propertyId: string): Promise<any[]>;
}

/**
 * Create a payment method service with the given Prisma client
 * Use this for tenant-scoped operations
 */
export function createPaymentMethodService(prisma: AnyPrismaClient = defaultPrisma): PaymentMethodService {
    async function create(tenantId: string, data: CreatePaymentMethodInput) {
        const { phases, ...methodData } = data;

        const method = await prisma.$transaction(async (tx: any) => {
            const created = await tx.propertyPaymentMethod.create({
                data: {
                    tenantId,
                    name: methodData.name,
                    description: methodData.description,
                    isActive: methodData.isActive ?? true,
                    allowEarlyPayoff: methodData.allowEarlyPayoff ?? true,
                    earlyPayoffPenaltyRate: methodData.earlyPayoffPenaltyRate,
                    autoActivatePhases: methodData.autoActivatePhases ?? true,
                    requiresManualApproval: methodData.requiresManualApproval ?? false,
                },
            });

            if (phases && phases.length > 0) {
                for (const phase of phases) {
                    if (phase.phaseCategory === 'PAYMENT' && !phase.paymentPlanId) {
                        throw new AppError(400, `Phase "${phase.name}" is a PAYMENT phase and requires paymentPlanId`);
                    }

                    // Store snapshots for audit
                    const stepDefinitionsSnapshot = phase.stepDefinitions ? phase.stepDefinitions : null;
                    const requiredDocumentSnapshot = phase.requiredDocuments ? phase.requiredDocuments : null;

                    const createdPhase = await tx.propertyPaymentMethodPhase.create({
                        data: {
                            paymentMethodId: created.id,
                            paymentPlanId: phase.paymentPlanId,
                            name: phase.name,
                            description: phase.description,
                            phaseCategory: phase.phaseCategory,
                            phaseType: phase.phaseType as PhaseType,
                            order: phase.order,
                            interestRate: phase.interestRate,
                            percentOfPrice: phase.percentOfPrice,
                            requiresPreviousPhaseCompletion: phase.requiresPreviousPhaseCompletion ?? true,
                            minimumCompletionPercentage: phase.minimumCompletionPercentage,
                            stepDefinitionsSnapshot,
                            requiredDocumentSnapshot,
                        },
                    });

                    // Create step child records
                    if (phase.stepDefinitions && phase.stepDefinitions.length > 0) {
                        for (const step of phase.stepDefinitions) {
                            await tx.paymentMethodPhaseStep.create({
                                data: {
                                    phaseId: createdPhase.id,
                                    name: step.name,
                                    stepType: step.stepType as StepType,
                                    order: step.order,
                                    metadata: step.metadata,
                                },
                            });
                        }
                    }

                    // Create required document child records
                    if (phase.requiredDocuments && phase.requiredDocuments.length > 0) {
                        for (const doc of phase.requiredDocuments) {
                            await tx.paymentMethodPhaseDocument.create({
                                data: {
                                    phaseId: createdPhase.id,
                                    documentType: doc.documentType,
                                    isRequired: doc.isRequired ?? true,
                                    description: doc.description,
                                    allowedMimeTypes: doc.allowedMimeTypes?.join(','),
                                    maxSizeBytes: doc.maxSizeBytes,
                                    metadata: doc.metadata,
                                },
                            });
                        }
                    }
                }
            }

            return created;
        });

        return findById(method.id);
    }

    async function findAll(filters?: { isActive?: boolean }) {
        const methods = await prisma.propertyPaymentMethod.findMany({
            where: filters,
            orderBy: { name: 'asc' },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        paymentPlan: true,
                        steps: {
                            orderBy: { order: 'asc' },
                        },
                        requiredDocuments: true,
                    },
                },
            },
        });
        return methods;
    }

    async function findById(id: string) {
        const method = await prisma.propertyPaymentMethod.findUnique({
            where: { id },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        paymentPlan: true,
                        steps: {
                            orderBy: { order: 'asc' },
                        },
                        requiredDocuments: true,
                    },
                },
                properties: {
                    include: {
                        property: true,
                    },
                },
            },
        });

        if (!method) {
            throw new AppError(404, 'Payment method not found');
        }

        return method;
    }

    async function update(id: string, data: UpdatePaymentMethodInput) {
        await findById(id);

        const { phases, ...methodData } = data;

        const updated = await prisma.propertyPaymentMethod.update({
            where: { id },
            data: methodData,
        });

        return findById(updated.id);
    }

    async function deleteMethod(id: string) {
        await findById(id);

        const contractCount = await prisma.contract.count({
            where: { paymentMethodId: id },
        });

        if (contractCount > 0) {
            throw new AppError(400, `Cannot delete payment method: used by ${contractCount} contract(s)`);
        }

        await prisma.$transaction(async (tx: any) => {
            await tx.propertyPaymentMethodPhase.deleteMany({
                where: { paymentMethodId: id },
            });

            await tx.propertyPaymentMethodLink.deleteMany({
                where: { paymentMethodId: id },
            });

            await tx.propertyPaymentMethod.delete({
                where: { id },
            });
        });

        return { success: true };
    }

    async function addPhase(methodId: string, data: AddPhaseInput) {
        await findById(methodId);

        if (data.phaseCategory === 'PAYMENT' && !data.paymentPlanId) {
            throw new AppError(400, 'PAYMENT phases require paymentPlanId');
        }

        // Store snapshots for audit
        const stepDefinitionsSnapshot = data.stepDefinitions ? data.stepDefinitions : null;
        const requiredDocumentSnapshot = data.requiredDocuments ? data.requiredDocuments : null;

        const phase = await prisma.$transaction(async (tx: any) => {
            const createdPhase = await tx.propertyPaymentMethodPhase.create({
                data: {
                    paymentMethodId: methodId,
                    paymentPlanId: data.paymentPlanId,
                    name: data.name,
                    description: data.description,
                    phaseCategory: data.phaseCategory,
                    phaseType: data.phaseType as PhaseType,
                    order: data.order,
                    interestRate: data.interestRate,
                    percentOfPrice: data.percentOfPrice,
                    requiresPreviousPhaseCompletion: data.requiresPreviousPhaseCompletion ?? true,
                    minimumCompletionPercentage: data.minimumCompletionPercentage,
                    stepDefinitionsSnapshot,
                    requiredDocumentSnapshot,
                },
            });

            // Create step child records
            if (data.stepDefinitions && data.stepDefinitions.length > 0) {
                for (const step of data.stepDefinitions) {
                    await tx.paymentMethodPhaseStep.create({
                        data: {
                            phaseId: createdPhase.id,
                            name: step.name,
                            stepType: step.stepType as StepType,
                            order: step.order,
                            metadata: step.metadata,
                        },
                    });
                }
            }

            // Create required document child records
            if (data.requiredDocuments && data.requiredDocuments.length > 0) {
                for (const doc of data.requiredDocuments) {
                    await tx.paymentMethodPhaseDocument.create({
                        data: {
                            phaseId: createdPhase.id,
                            documentType: doc.documentType,
                            isRequired: doc.isRequired ?? true,
                            description: doc.description,
                            allowedMimeTypes: doc.allowedMimeTypes?.join(','),
                            maxSizeBytes: doc.maxSizeBytes,
                            metadata: doc.metadata,
                        },
                    });
                }
            }

            return createdPhase;
        });

        return prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phase.id },
            include: {
                paymentPlan: true,
                steps: {
                    orderBy: { order: 'asc' },
                },
                requiredDocuments: true,
            },
        });
    }

    async function updatePhase(phaseId: string, data: Partial<AddPhaseInput>) {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        // Extract child data
        const { requiredDocuments, stepDefinitions, phaseType, ...rest } = data;
        const updateData: Record<string, any> = { ...rest };

        // Add phaseType if provided (as enum)
        if (phaseType !== undefined) {
            updateData.phaseType = phaseType;
        }

        // Update snapshots if new data is provided
        if (stepDefinitions !== undefined) {
            updateData.stepDefinitionsSnapshot = stepDefinitions;
        }
        if (requiredDocuments !== undefined) {
            updateData.requiredDocumentSnapshot = requiredDocuments;
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const updatedPhase = await tx.propertyPaymentMethodPhase.update({
                where: { id: phaseId },
                data: updateData,
            });

            // Replace step child records if provided
            if (stepDefinitions !== undefined) {
                await tx.paymentMethodPhaseStep.deleteMany({ where: { phaseId } });
                if (stepDefinitions && stepDefinitions.length > 0) {
                    for (const step of stepDefinitions) {
                        await tx.paymentMethodPhaseStep.create({
                            data: {
                                phaseId,
                                name: step.name,
                                stepType: step.stepType as StepType,
                                order: step.order,
                                metadata: step.metadata,
                            },
                        });
                    }
                }
            }

            // Replace required document child records if provided
            if (requiredDocuments !== undefined) {
                await tx.paymentMethodPhaseDocument.deleteMany({ where: { phaseId } });
                if (requiredDocuments && requiredDocuments.length > 0) {
                    for (const doc of requiredDocuments) {
                        await tx.paymentMethodPhaseDocument.create({
                            data: {
                                phaseId,
                                documentType: doc.documentType,
                                isRequired: doc.isRequired ?? true,
                                description: doc.description,
                                allowedMimeTypes: doc.allowedMimeTypes?.join(','),
                                maxSizeBytes: doc.maxSizeBytes,
                                metadata: doc.metadata,
                            },
                        });
                    }
                }
            }

            return updatedPhase;
        });

        return prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: updated.id },
            include: {
                paymentPlan: true,
                steps: {
                    orderBy: { order: 'asc' },
                },
                requiredDocuments: true,
            },
        });
    }

    async function deletePhase(phaseId: string) {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        await prisma.propertyPaymentMethodPhase.delete({
            where: { id: phaseId },
        });

        return { success: true };
    }

    async function reorderPhases(methodId: string, phaseOrders: { phaseId: string; order: number }[]) {
        await findById(methodId);

        await prisma.$transaction(async (tx: any) => {
            for (const { phaseId, order } of phaseOrders) {
                await tx.propertyPaymentMethodPhase.update({
                    where: { id: phaseId },
                    data: { order },
                });
            }
        });

        return findById(methodId);
    }

    async function linkToProperty(methodId: string, data: LinkToPropertyInput) {
        await findById(methodId);

        const property = await prisma.property.findUnique({
            where: { id: data.propertyId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        const link = await prisma.propertyPaymentMethodLink.upsert({
            where: {
                propertyId_paymentMethodId: {
                    propertyId: data.propertyId,
                    paymentMethodId: methodId,
                },
            },
            update: {
                isDefault: data.isDefault,
                isActive: data.isActive,
            },
            create: {
                propertyId: data.propertyId,
                paymentMethodId: methodId,
                isDefault: data.isDefault ?? false,
                isActive: data.isActive ?? true,
            },
        });

        return link;
    }

    async function unlinkFromProperty(methodId: string, propertyId: string) {
        await prisma.propertyPaymentMethodLink.delete({
            where: {
                propertyId_paymentMethodId: {
                    propertyId,
                    paymentMethodId: methodId,
                },
            },
        });

        return { success: true };
    }

    async function getMethodsForProperty(propertyId: string) {
        const links = await prisma.propertyPaymentMethodLink.findMany({
            where: {
                propertyId,
                isActive: true,
            },
            include: {
                paymentMethod: {
                    include: {
                        phases: {
                            orderBy: { order: 'asc' },
                            include: {
                                paymentPlan: true,
                                steps: {
                                    orderBy: { order: 'asc' },
                                },
                                requiredDocuments: true,
                            },
                        },
                    },
                },
            },
        });

        return links;
    }

    return {
        create,
        findAll,
        findById,
        update,
        delete: deleteMethod,
        addPhase,
        updatePhase,
        deletePhase,
        reorderPhases,
        linkToProperty,
        unlinkFromProperty,
        getMethodsForProperty,
    };
}

// Default instance for backward compatibility
export const paymentMethodService: PaymentMethodService = createPaymentMethodService();
