import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import type {
    CreatePaymentMethodInput,
    UpdatePaymentMethodInput,
    AddPhaseInput,
    LinkToPropertyInput,
} from '../validators/payment-method.validator';

type AnyPrismaClient = PrismaClient;

/**
 * Create a payment method service with the given Prisma client
 * Use this for tenant-scoped operations
 */
export function createPaymentMethodService(prisma: AnyPrismaClient = defaultPrisma) {
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

                    await tx.propertyPaymentMethodPhase.create({
                        data: {
                            paymentMethodId: created.id,
                            paymentPlanId: phase.paymentPlanId,
                            name: phase.name,
                            description: phase.description,
                            phaseCategory: phase.phaseCategory,
                            phaseType: phase.phaseType,
                            order: phase.order,
                            interestRate: phase.interestRate,
                            percentOfPrice: phase.percentOfPrice,
                            requiresPreviousPhaseCompletion: phase.requiresPreviousPhaseCompletion ?? true,
                            minimumCompletionPercentage: phase.minimumCompletionPercentage,
                            requiredDocumentTypes: phase.requiredDocumentTypes,
                            stepDefinitions: phase.stepDefinitions,
                        },
                    });
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

        const phase = await prisma.propertyPaymentMethodPhase.create({
            data: {
                paymentMethodId: methodId,
                paymentPlanId: data.paymentPlanId,
                name: data.name,
                description: data.description,
                phaseCategory: data.phaseCategory,
                phaseType: data.phaseType,
                order: data.order,
                interestRate: data.interestRate,
                percentOfPrice: data.percentOfPrice,
                requiresPreviousPhaseCompletion: data.requiresPreviousPhaseCompletion ?? true,
                minimumCompletionPercentage: data.minimumCompletionPercentage,
                requiredDocumentTypes: data.requiredDocumentTypes,
                stepDefinitions: data.stepDefinitions,
            },
            include: {
                paymentPlan: true,
            },
        });

        return phase;
    }

    async function updatePhase(phaseId: string, data: Partial<AddPhaseInput>) {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        const updated = await prisma.propertyPaymentMethodPhase.update({
            where: { id: phaseId },
            data,
            include: {
                paymentPlan: true,
            },
        });

        return updated;
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
export const paymentMethodService = createPaymentMethodService();
