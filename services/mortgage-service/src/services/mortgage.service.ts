import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type {
    CreateMortgageInput,
    UpdateMortgageInput,
    CreateMortgageTypeInput,
    CreatePaymentInput,
    CreateDownpaymentInput,
} from '../validators/mortgage.validator';

class MortgageService {
    async createMortgage(data: CreateMortgageInput) {
        const mortgage = await prisma.mortgage.create({
            data,
        });
        return mortgage;
    }

    async getMortgages(filters?: { borrowerId?: string; propertyId?: string }) {
        const mortgages = await prisma.mortgage.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
            include: {
                property: true,
                mortgageType: true,
            },
        });
        return mortgages;
    }

    async getMortgageById(id: string) {
        const mortgage = await prisma.mortgage.findUnique({
            where: { id },
            include: {
                property: true,
                mortgageType: true,
                downpaymentPlan: true,
            },
        });

        if (!mortgage) {
            throw new AppError(404, 'Mortgage not found');
        }

        return mortgage;
    }

    async updateMortgage(id: string, data: UpdateMortgageInput, userId: string) {
        // Verify ownership
        const mortgage = await prisma.mortgage.findUnique({
            where: { id },
        });

        if (!mortgage) {
            throw new AppError(404, 'Mortgage not found');
        }

        if (mortgage.borrowerId !== userId) {
            throw new AppError(403, 'Unauthorized to update this mortgage');
        }

        const updated = await prisma.mortgage.update({
            where: { id },
            data,
        });

        return updated;
    }

    async deleteMortgage(id: string, userId: string) {
        // Verify ownership
        const mortgage = await prisma.mortgage.findUnique({
            where: { id },
        });

        if (!mortgage) {
            throw new AppError(404, 'Mortgage not found');
        }

        if (mortgage.borrowerId !== userId) {
            throw new AppError(403, 'Unauthorized to delete this mortgage');
        }

        await prisma.mortgage.delete({
            where: { id },
        });

        return { success: true };
    }
}

class MortgageTypeService {
    async createMortgageType(data: CreateMortgageTypeInput) {
        const mortgageType = await prisma.mortgageType.create({
            data,
        });
        return mortgageType;
    }

    async getMortgageTypes() {
        const types = await prisma.mortgageType.findMany({
            orderBy: { name: 'asc' },
        });
        return types;
    }
}

class PaymentService {
    async createPayment(data: CreatePaymentInput) {
        const payment = await prisma.payment.create({
            data,
        });
        return payment;
    }

    async getPaymentsByPlan(planId: string) {
        const payments = await prisma.payment.findMany({
            where: { planId },
            orderBy: { createdAt: 'desc' },
        });
        return payments;
    }
}

class DownpaymentService {
    async createDownpayment(data: CreateDownpaymentInput) {
        const downpayment = await prisma.mortgageDownpaymentPayment.create({
            data,
        });
        return downpayment;
    }

    async getDownpaymentsByMortgage(planId: string) {
        const downpayments = await prisma.mortgageDownpaymentPayment.findMany({
            where: { planId },
            orderBy: { createdAt: 'desc' },
        });
        return downpayments;
    }
}

export const mortgageService = new MortgageService();
export const mortgageTypeService = new MortgageTypeService();
export const paymentService = new PaymentService();
export const downpaymentService = new DownpaymentService();
