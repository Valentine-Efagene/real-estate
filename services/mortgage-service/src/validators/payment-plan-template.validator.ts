import { z } from 'zod';

export const phaseTypeEnum = z.enum(['DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'GRACE_PERIOD', 'CUSTOM']);
export const paymentFrequencyEnum = z.enum(['MONTHLY', 'BIWEEKLY', 'WEEKLY', 'CUSTOM']);
export const templateCategoryEnum = z.enum(['STANDARD', 'FLEXIBLE', 'CUSTOM']);

export const paymentPhaseTemplateSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    phaseType: phaseTypeEnum,
    order: z.number().int().min(0),
    durationMonths: z.number().int().min(1).optional(),
    gracePeriodDays: z.number().int().min(0).optional(),
    paymentFrequency: paymentFrequencyEnum.optional(),
    interestRate: z.number().min(0).max(100).optional(),
    customFrequencyDays: z.number().int().min(1).optional(),
    numberOfInstallments: z.number().int().min(1).optional(),
    installmentAmount: z.number().min(0).optional(),
    calculateInterestDaily: z.boolean().optional(),
    requiresPreviousPhaseCompletion: z.boolean().optional(),
    minimumCompletionPercentage: z.number().min(0).max(100).optional(),
    requiredDocumentTypes: z.string().optional(),
});

export const createPaymentPlanTemplateSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    category: templateCategoryEnum,
    allowEarlyPayoff: z.boolean().optional(),
    earlyPayoffPenaltyRate: z.number().min(0).max(100).optional(),
    autoActivatePhases: z.boolean().optional(),
    requiresManualApproval: z.boolean().optional(),
    phases: z.array(paymentPhaseTemplateSchema).optional(),
});

export const updatePaymentPlanTemplateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    category: templateCategoryEnum.optional(),
    isActive: z.boolean().optional(),
    allowEarlyPayoff: z.boolean().optional(),
    earlyPayoffPenaltyRate: z.number().min(0).max(100).optional(),
    autoActivatePhases: z.boolean().optional(),
    requiresManualApproval: z.boolean().optional(),
});

export const clonePaymentPlanTemplateSchema = z.object({
    newName: z.string().min(1).max(255),
});
