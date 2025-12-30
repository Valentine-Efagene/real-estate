import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Payment frequency enum
export const PaymentFrequency = z.enum([
    'MONTHLY',
    'BIWEEKLY',
    'WEEKLY',
    'ONE_TIME',
    'CUSTOM',
]);

// Create payment plan schema
export const CreatePaymentPlanSchema = z
    .object({
        name: z.string().min(1).max(100).openapi({ example: 'Monthly360' }),
        description: z.string().optional().openapi({ example: '30-year monthly payment plan' }),
        isActive: z.boolean().default(true),
        paymentFrequency: PaymentFrequency.openapi({ example: 'MONTHLY' }),
        customFrequencyDays: z.number().int().positive().optional().openapi({ example: 14 }),
        numberOfInstallments: z.number().int().positive().openapi({ example: 360 }),
        calculateInterestDaily: z.boolean().default(false),
        gracePeriodDays: z.number().int().min(0).default(0).openapi({ example: 5 }),
    })
    .openapi('CreatePaymentPlan');

export const UpdatePaymentPlanSchema = CreatePaymentPlanSchema.partial().openapi('UpdatePaymentPlan');

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
