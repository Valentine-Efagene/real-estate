import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Payment frequency enum (matches Prisma PaymentFrequency)
export const PaymentFrequencyEnum = z.enum([
    'MONTHLY',
    'BIWEEKLY',
    'WEEKLY',
    'ONE_TIME',
    'CUSTOM',
    'MINUTE',
]);

// Base schema without transform for partial to work
const PaymentPlanBaseSchema = z.object({
    name: z.string().min(1).max(100).openapi({ example: 'Monthly360' }),
    description: z.string().optional().openapi({ example: '30-year monthly payment plan' }),
    isActive: z.boolean().default(true),
    paymentFrequency: PaymentFrequencyEnum.optional().openapi({ example: 'MONTHLY' }),
    frequency: PaymentFrequencyEnum.optional().openapi({ example: 'MONTHLY' }), // alias for paymentFrequency
    frequencyMultiplier: z.number().int().min(1).default(1).openapi({ example: 1, description: 'Multiplier for the period (e.g., MONTHLY × 3 = quarterly)' }),
    customFrequencyDays: z.number().int().positive().optional().openapi({ example: 14 }),
    numberOfInstallments: z.number().int().positive().optional().openapi({ example: 360 }),
    calculateInterestDaily: z.boolean().default(false),
    gracePeriodDays: z.number().int().min(0).default(0).openapi({ example: 5 }),
    interestRate: z.number().min(0).optional().openapi({ example: 9.5 }),
    // Fund collection behavior
    // true = we collect funds via wallet/gateway (e.g., downpayment)
    // false = external payment, we only track/reconcile (e.g., bank mortgage)
    collectFunds: z.boolean().default(true).openapi({ example: true, description: 'Whether we collect funds or just track external payments' }),
    // Flexible term configuration (for user-selectable duration like mortgages)
    allowFlexibleTerm: z.boolean().default(false).openapi({ example: false, description: 'If true, user can select term within range' }),
    minTermMonths: z.number().int().positive().optional().openapi({ example: 60, description: 'Minimum term in months (e.g., 60 = 5 years)' }),
    maxTermMonths: z.number().int().positive().optional().openapi({ example: 360, description: 'Maximum term in months (e.g., 360 = 30 years)' }),
    termStepMonths: z.number().int().positive().optional().openapi({ example: 12, description: 'Term increments in months (e.g., 12 = 1 year)' }),
    // Age-based constraints (for mortgage eligibility)
    maxAgeAtMaturity: z.number().int().positive().optional().openapi({ example: 65, description: 'User age + term cannot exceed this' }),
});

// Create payment plan schema with transform
export const CreatePaymentPlanSchema = PaymentPlanBaseSchema
    .transform((data) => ({
        ...data,
        paymentFrequency: data.paymentFrequency || data.frequency || 'MONTHLY',
    }))
    .openapi('CreatePaymentPlan');

export const UpdatePaymentPlanSchema = PaymentPlanBaseSchema.partial().openapi('UpdatePaymentPlan');

export const PaymentPlanResponseSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        isActive: z.boolean(),
        paymentFrequency: z.string(),
        frequencyMultiplier: z.number(),
        customFrequencyDays: z.number().nullable(),
        numberOfInstallments: z.number(),
        calculateInterestDaily: z.boolean(),
        gracePeriodDays: z.number(),
        createdAt: z.date(),
        updatedAt: z.date(),
    })
    .openapi('PaymentPlanResponse');

export type CreatePaymentPlanInput = z.infer<typeof CreatePaymentPlanSchema>;
export type UpdatePaymentPlanInput = z.infer<typeof UpdatePaymentPlanSchema>;
