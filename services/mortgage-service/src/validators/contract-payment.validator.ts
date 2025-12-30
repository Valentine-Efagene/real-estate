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
        contractId: z.string(),
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
        gatewayResponse: z.record(z.any()).optional(),
    })
    .openapi('ProcessPayment');

// Refund payment
export const RefundPaymentSchema = z
    .object({
        reason: z.string().optional(),
    })
    .openapi('RefundPayment');

// Payment response
export const ContractPaymentResponseSchema = z
    .object({
        id: z.string(),
        contractId: z.string(),
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
    .openapi('ContractPaymentResponse');

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;
