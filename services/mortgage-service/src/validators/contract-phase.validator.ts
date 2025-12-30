import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Activate phase
export const ActivatePhaseSchema = z
    .object({
        startDate: z.string().datetime().optional(),
    })
    .openapi('ActivatePhase');

// Complete documentation step
export const CompleteStepSchema = z
    .object({
        stepId: z.string(),
        decision: z.enum(['APPROVED', 'REJECTED', 'REQUEST_CHANGES']).optional(),
        comment: z.string().optional(),
    })
    .openapi('CompleteStep');

// Upload document for a step
export const UploadDocumentSchema = z
    .object({
        stepId: z.string().optional(),
        name: z.string().min(1).max(200),
        url: z.string().url(),
        type: z.string().min(1).max(50).openapi({ example: 'ID' }),
    })
    .openapi('UploadDocument');

// Approve document
export const ApproveDocumentSchema = z
    .object({
        status: z.enum(['APPROVED', 'REJECTED']),
        comment: z.string().optional(),
    })
    .openapi('ApproveDocument');

// Generate installments for a payment phase
export const GenerateInstallmentsSchema = z
    .object({
        startDate: z.string().datetime(),
        interestRate: z.number().min(0).max(100).optional(),
    })
    .openapi('GenerateInstallments');

// Phase response
export const ContractPhaseResponseSchema = z
    .object({
        id: z.string(),
        contractId: z.string(),
        paymentPlanId: z.string().nullable(),
        name: z.string(),
        description: z.string().nullable(),
        phaseCategory: z.string(),
        phaseType: z.string(),
        order: z.number(),
        status: z.string(),
        totalAmount: z.number().nullable(),
        paidAmount: z.number(),
        remainingAmount: z.number().nullable(),
        interestRate: z.number().nullable(),
        dueDate: z.date().nullable(),
        startDate: z.date().nullable(),
        endDate: z.date().nullable(),
        activatedAt: z.date().nullable(),
        completedAt: z.date().nullable(),
        createdAt: z.date(),
        updatedAt: z.date(),
        installments: z.array(z.any()).optional(),
        steps: z.array(z.any()).optional(),
    })
    .openapi('ContractPhaseResponse');

export type ActivatePhaseInput = z.infer<typeof ActivatePhaseSchema>;
export type CompleteStepInput = z.infer<typeof CompleteStepSchema>;
export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;
export type ApproveDocumentInput = z.infer<typeof ApproveDocumentSchema>;
export type GenerateInstallmentsInput = z.infer<typeof GenerateInstallmentsSchema>;
