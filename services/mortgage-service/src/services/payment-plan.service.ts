import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type { CreatePaymentPlanInput, UpdatePaymentPlanInput } from '../validators/payment-plan.validator';

class PaymentPlanService {
    async create(tenantId: string, data: CreatePaymentPlanInput) {
        // Validate custom frequency
        if (data.paymentFrequency === 'CUSTOM' && !data.customFrequencyDays) {
            throw new AppError(400, 'customFrequencyDays is required for CUSTOM frequency');
        }

        const plan = await prisma.paymentPlan.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                isActive: data.isActive ?? true,
                paymentFrequency: data.paymentFrequency,
                customFrequencyDays: data.customFrequencyDays,
                numberOfInstallments: data.numberOfInstallments,
                calculateInterestDaily: data.calculateInterestDaily ?? false,
                gracePeriodDays: data.gracePeriodDays ?? 0,
            },
        });

        return plan;
    }

    async findAll(filters?: { isActive?: boolean }) {
        const plans = await prisma.paymentPlan.findMany({
            where: filters,
            orderBy: { name: 'asc' },
        });
        return plans;
    }

    async findById(id: string) {
        const plan = await prisma.paymentPlan.findUnique({
            where: { id },
        });

        if (!plan) {
            throw new AppError(404, 'Payment plan not found');
        }

        return plan;
    }

    async findByName(tenantId: string | null, name: string) {
        // For global plans (tenantId is null), search by name only
        // For tenant-specific plans, search by tenantId + name compound key
        if (!tenantId) {
            const plan = await prisma.paymentPlan.findFirst({
                where: { name, tenantId: null },
            });
            return plan;
        }

        const plan = await prisma.paymentPlan.findUnique({
            where: { tenantId_name: { tenantId, name } },
        });

        return plan;
    }

    async update(id: string, data: UpdatePaymentPlanInput) {
        const existing = await this.findById(id);

        // Validate custom frequency
        const frequency = data.paymentFrequency ?? existing.paymentFrequency;
        const customDays = data.customFrequencyDays ?? existing.customFrequencyDays;
        if (frequency === 'CUSTOM' && !customDays) {
            throw new AppError(400, 'customFrequencyDays is required for CUSTOM frequency');
        }

        const updated = await prisma.paymentPlan.update({
            where: { id },
            data,
        });

        return updated;
    }

    async delete(id: string) {
        await this.findById(id);

        // Check if plan is in use
        const usageCount = await prisma.propertyPaymentMethodPhase.count({
            where: { paymentPlanId: id },
        });

        if (usageCount > 0) {
            throw new AppError(400, `Cannot delete payment plan: used by ${usageCount} payment method phase(s)`);
        }

        await prisma.paymentPlan.delete({
            where: { id },
        });

        return { success: true };
    }

    async clone(id: string, newName: string) {
        const source = await this.findById(id);

        const cloned = await prisma.paymentPlan.create({
            data: {
                name: newName,
                description: source.description,
                isActive: source.isActive,
                paymentFrequency: source.paymentFrequency,
                customFrequencyDays: source.customFrequencyDays,
                numberOfInstallments: source.numberOfInstallments,
                calculateInterestDaily: source.calculateInterestDaily,
                gracePeriodDays: source.gracePeriodDays,
            },
        });

        return cloned;
    }

    /**
     * Calculate the interval in days between installments based on frequency
     */
    getIntervalDays(plan: { paymentFrequency: string; customFrequencyDays: number | null }): number {
        switch (plan.paymentFrequency) {
            case 'MONTHLY':
                return 30;
            case 'BIWEEKLY':
                return 14;
            case 'WEEKLY':
                return 7;
            case 'ONE_TIME':
                return 0;
            case 'CUSTOM':
                return plan.customFrequencyDays ?? 30;
            default:
                return 30;
        }
    }
}

export const paymentPlanService = new PaymentPlanService();
