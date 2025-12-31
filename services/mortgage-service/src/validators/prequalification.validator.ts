import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Prequalification status enum
export const PrequalificationStatus = z.enum([
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
]);

// Create prequalification schema
export const CreatePrequalificationSchema = z
    .object({
        propertyId: z.string().uuid().openapi({ example: 'prop-uuid-123' }),
        paymentMethodId: z.string().uuid().openapi({ example: 'pm-uuid-123' }),
        answers: z.record(z.string(), z.any()).optional().openapi({ example: { employmentType: 'EMPLOYED', yearsEmployed: 5 } }),
        requestedAmount: z.number().positive().optional().openapi({ example: 500000 }),
        monthlyIncome: z.number().positive().optional().openapi({ example: 15000 }),
        monthlyExpenses: z.number().min(0).optional().openapi({ example: 5000 }),
    })
    .openapi('CreatePrequalification');

// Update prequalification schema
export const UpdatePrequalificationSchema = z
    .object({
        answers: z.record(z.string(), z.any()).optional(),
        requestedAmount: z.number().positive().optional(),
        monthlyIncome: z.number().positive().optional(),
        monthlyExpenses: z.number().min(0).optional(),
    })
    .openapi('UpdatePrequalification');

// Submit document schema
export const SubmitDocumentSchema = z
    .object({
        documentType: z.string().min(1).openapi({ example: 'ID_CARD' }),
        documentUrl: z.string().url().openapi({ example: 'https://s3.amazonaws.com/bucket/doc.pdf' }),
        fileName: z.string().optional().openapi({ example: 'passport.pdf' }),
        mimeType: z.string().optional().openapi({ example: 'application/pdf' }),
    })
    .openapi('SubmitDocument');

// Review prequalification schema
export const ReviewPrequalificationSchema = z
    .object({
        status: z.enum(['APPROVED', 'REJECTED']).openapi({ example: 'APPROVED' }),
        notes: z.string().optional().openapi({ example: 'All documents verified successfully' }),
        suggestedTermMonths: z.number().int().positive().optional().openapi({ example: 240 }),
        expiresAt: z.string().datetime().optional().openapi({ example: '2026-06-30T00:00:00Z' }),
    })
    .openapi('ReviewPrequalification');

export type CreatePrequalificationInput = z.infer<typeof CreatePrequalificationSchema>;
export type UpdatePrequalificationInput = z.infer<typeof UpdatePrequalificationSchema>;
export type SubmitDocumentInput = z.infer<typeof SubmitDocumentSchema>;
export type ReviewPrequalificationInput = z.infer<typeof ReviewPrequalificationSchema>;
