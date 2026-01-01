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
]);

// Base schema without transform for partial to work
const PaymentPlanBaseSchema = z.object({
    name: z.string().min(1).max(100).openapi({ example: 'Monthly360' }),
    description: z.string().optional().openapi({ example: '30-year monthly payment plan' }),
    isActive: z.boolean().default(true),
    paymentFrequency: PaymentFrequencyEnum.optional().openapi({ example: 'MONTHLY' }),
    frequency: PaymentFrequencyEnum.optional().openapi({ example: 'MONTHLY' }), // alias for paymentFrequency
    customFrequencyDays: z.number().int().positive().optional().openapi({ example: 14 }),
    numberOfInstallments: z.number().int().positive().openapi({ example: 360 }),
    calculateInterestDaily: z.boolean().default(false),
    gracePeriodDays: z.number().int().min(0).default(0).openapi({ example: 5 }),
    interestRate: z.number().min(0).optional().openapi({ example: 9.5 }),
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
