import { z } from 'zod';
import { phaseTypeEnum, paymentFrequencyEnum } from './payment-plan-template.validator.js';

export const createMortgagePhaseSchema = z.object({
    mortgageId: z.string().cuid(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    phaseType: phaseTypeEnum,
    order: z.number().int().min(0),
    totalAmount: z.number().min(0),
    durationMonths: z.number().int().min(1).optional(),
    gracePeriodDays: z.number().int().min(0).optional(),
    paymentFrequency: paymentFrequencyEnum.optional(),
    interestRate: z.number().min(0).max(100).optional(),
    customFrequencyDays: z.number().int().min(1).optional(),
    numberOfInstallments: z.number().int().min(1).optional(),
    installmentAmount: z.number().min(0).optional(),
    calculateInterestDaily: z.boolean().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});

export const generateInstallmentsSchema = z.object({
    totalAmount: z.number().min(0),
    durationMonths: z.number().int().min(1),
    interestRate: z.number().min(0).max(100),
    frequency: paymentFrequencyEnum.refine(val => val !== 'CUSTOM', {
        message: 'Custom frequency not supported for auto-generation',
    }),
    startDate: z.string().datetime(),
});
