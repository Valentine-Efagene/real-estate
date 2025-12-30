import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type {
    CreatePaymentMethodInput,
    UpdatePaymentMethodInput,
    AddPhaseInput,
    LinkToPropertyInput,
} from '../validators/payment-method.validator.js';

class PaymentMethodService {
    async create(data: CreatePaymentMethodInput) {
        const { phases, ...methodData } = data;

        const method = await prisma.$transaction(async (tx) => {
            // Create the payment method
            const created = await tx.propertyPaymentMethod.create({
                data: {
                    name: methodData.name,
                    description: methodData.description,
                    isActive: methodData.isActive ?? true,
                    allowEarlyPayoff: methodData.allowEarlyPayoff ?? true,
                    earlyPayoffPenaltyRate: methodData.earlyPayoffPenaltyRate,
                    autoActivatePhases: methodData.autoActivatePhases ?? true,
                    requiresManualApproval: methodData.requiresManualApproval ?? false,
                },
            });

            // Create phases if provided
            if (phases && phases.length > 0) {
                for (const phase of phases) {
                    // Validate: PAYMENT phases require paymentPlanId
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

        return this.findById(method.id);
    }

    async findAll(filters?: { isActive?: boolean }) {
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

    async findById(id: string) {
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

    async update(id: string, data: UpdatePaymentMethodInput) {
        await this.findById(id);

        const { phases, ...methodData } = data;

        const updated = await prisma.propertyPaymentMethod.update({
            where: { id },
            data: methodData,
        });

        return this.findById(updated.id);
    }

    async delete(id: string) {
        await this.findById(id);

        // Check if method is in use by contracts
        const contractCount = await prisma.contract.count({
            where: { paymentMethodId: id },
        });

        if (contractCount > 0) {
            throw new AppError(400, `Cannot delete payment method: used by ${contractCount} contract(s)`);
        }

        await prisma.$transaction(async (tx) => {
            // Delete phases first
            await tx.propertyPaymentMethodPhase.deleteMany({
                where: { paymentMethodId: id },
            });

            // Delete property links
            await tx.propertyPaymentMethodLink.deleteMany({
                where: { paymentMethodId: id },
            });

            // Delete method
            await tx.propertyPaymentMethod.delete({
                where: { id },
            });
        });

        return { success: true };
    }

    async addPhase(methodId: string, data: AddPhaseInput) {
        await this.findById(methodId);

        // Validate: PAYMENT phases require paymentPlanId
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

    async updatePhase(phaseId: string, data: Partial<AddPhaseInput>) {
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

    async deletePhase(phaseId: string) {
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

    async reorderPhases(methodId: string, phaseOrders: { phaseId: string; order: number }[]) {
        await this.findById(methodId);

        await prisma.$transaction(async (tx) => {
            for (const { phaseId, order } of phaseOrders) {
                await tx.propertyPaymentMethodPhase.update({
                    where: { id: phaseId },
                    data: { order },
                });
            }
        });

        return this.findById(methodId);
    }

    async linkToProperty(methodId: string, data: LinkToPropertyInput) {
        await this.findById(methodId);

        // Check if property exists
        const property = await prisma.property.findUnique({
            where: { id: data.propertyId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        // Create or update link
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

    async unlinkFromProperty(methodId: string, propertyId: string) {
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

    async getMethodsForProperty(propertyId: string) {
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
}

export const paymentMethodService = new PaymentMethodService();
