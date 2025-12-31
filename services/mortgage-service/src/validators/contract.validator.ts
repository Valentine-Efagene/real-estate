import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Create contract from payment method
export const CreateContractSchema = z
    .object({
        prequalificationId: z.string().optional(),
        propertyUnitId: z.string(),
        buyerId: z.string().optional(), // Will use x-user-id header if not provided
        sellerId: z.string().optional(),
        paymentMethodId: z.string(),
        title: z.string().min(1).max(200).openapi({ example: 'Purchase Agreement - Unit A1' }),
        description: z.string().optional(),
        contractType: z.string().min(1).max(50).openapi({ example: 'MORTGAGE' }),
        totalAmount: z.number().positive().optional().openapi({ example: 500000 }), // If not provided, uses unit price
        downPayment: z.number().min(0).optional().openapi({ example: 50000 }),
        interestRate: z.number().min(0).max(100).optional().openapi({ example: 5.5 }),
        termMonths: z.number().int().positive().optional().openapi({ example: 360 }),
        startDate: z.string().datetime().optional(),
    })
    .openapi('CreateContract');

export const UpdateContractSchema = z
    .object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED']).optional(),
    })
    .openapi('UpdateContract');

// Transition contract state
export const TransitionContractSchema = z
    .object({
        trigger: z.string().min(1).optional().openapi({ example: 'SUBMIT' }),
        action: z.string().min(1).optional().openapi({ example: 'SUBMIT' }),
        note: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
    })
    .transform((data) => ({
        ...data,
        trigger: data.trigger || data.action!, // Normalize action to trigger
    }))
    .openapi('TransitionContract');

// Sign contract
export const SignContractSchema = z
    .object({
        signedAt: z.string().datetime().optional(),
    })
    .openapi('SignContract');

export const ContractResponseSchema = z
    .object({
        id: z.string(),
        propertyUnitId: z.string(),
        buyerId: z.string(),
        sellerId: z.string().nullable(),
        paymentMethodId: z.string().nullable(),
        contractNumber: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        contractType: z.string(),
        totalAmount: z.number(),
        downPayment: z.number(),
        downPaymentPaid: z.number(),
        principal: z.number().nullable(),
        interestRate: z.number().nullable(),
        termMonths: z.number().nullable(),
        periodicPayment: z.number().nullable(),
        totalPaidToDate: z.number(),
        totalInterestPaid: z.number(),
        status: z.string(),
        state: z.string(),
        currentPhaseId: z.string().nullable(),
        createdAt: z.date(),
        updatedAt: z.date(),
        phases: z.array(z.any()).optional(),
    })
    .openapi('ContractResponse');

export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type UpdateContractInput = z.infer<typeof UpdateContractSchema>;
export type TransitionContractInput = z.infer<typeof TransitionContractSchema>;
export type SignContractInput = z.infer<typeof SignContractSchema>;
