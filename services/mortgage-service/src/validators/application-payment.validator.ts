import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Payment method enum
export const PaymentMethod = z.enum([
    'BANK_TRANSFER',
    'CREDIT_CARD',
    'WALLET',
    'CASH',
    'CHECK',
]);

// Create payment
export const CreatePaymentSchema = z
    .object({
        applicationId: z.string(),
        phaseId: z.string().optional(),
        installmentId: z.string().optional(),
        amount: z.number().positive(),
        paymentMethod: PaymentMethod,
        reference: z.string().optional(),
    })
    .openapi('CreatePayment');

// Process payment (for webhook/callback)
export const ProcessPaymentSchema = z
    .object({
        reference: z.string(),
        status: z.enum(['COMPLETED', 'FAILED']),
        gatewayResponse: z.record(z.string(), z.any()).optional(),
    })
    .openapi('ProcessPayment');

// Refund payment
export const RefundPaymentSchema = z
    .object({
        reason: z.string().optional(),
    })
    .openapi('RefundPayment');

export const ApplicationAdjustmentTypeSchema = z.enum([
    'PROMO_DISCOUNT',
    'THIRD_PARTY_CREDIT',
    'WAIVER',
    'MANUAL_ADJUSTMENT',
    'SURCHARGE',
    'CORRECTION',
]);

export const AdjustmentDirectionSchema = z.enum(['REDUCTION', 'ADDITION']);

export const AdjustmentSourceTypeSchema = z.enum([
    'MANUAL',
    'PROMO',
    'RSA_PFA',
    'BANK_DIRECT',
    'SYSTEM',
]);

export const CreateApplicationAdjustmentSchema = z
    .object({
        applicationId: z.string(),
        phaseId: z.string().optional(),
        installmentId: z.string().optional(),
        type: ApplicationAdjustmentTypeSchema,
        direction: AdjustmentDirectionSchema.default('REDUCTION'),
        amount: z.number().positive(),
        sourceType: AdjustmentSourceTypeSchema.default('MANUAL'),
        sourceOrganizationId: z.string().optional(),
        sourceReference: z.string().optional(),
        description: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
    })
    .openapi('CreateApplicationAdjustment');

// Payment response
export const ApplicationPaymentResponseSchema = z
    .object({
        id: z.string(),
        applicationId: z.string(),
        phaseId: z.string().nullable(),
        installmentId: z.string().nullable(),
        payerId: z.string().nullable(),
        amount: z.number(),
        principalAmount: z.number(),
        interestAmount: z.number(),
        lateFeeAmount: z.number(),
        paymentMethod: z.string(),
        status: z.string(),
        reference: z.string().nullable(),
        processedAt: z.date().nullable(),
        createdAt: z.date(),
        updatedAt: z.date(),
    })
    .openapi('ApplicationPaymentResponse');

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;
export type CreateApplicationAdjustmentInput = z.infer<typeof CreateApplicationAdjustmentSchema>;
