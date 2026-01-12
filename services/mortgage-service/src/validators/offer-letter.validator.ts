import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Generate offer letter
export const GenerateOfferLetterSchema = z
    .object({
        applicationId: z.string(),
        type: z.enum(['PROVISIONAL', 'FINAL']),
        templateId: z.string().optional(), // Use default template if not provided
        expiresInDays: z.number().int().positive().default(30),
        customMergeData: z.record(z.string(), z.any()).optional(),
    })
    .openapi('GenerateOfferLetter');

export type GenerateOfferLetterInput = z.infer<typeof GenerateOfferLetterSchema>;

// Send offer letter
export const SendOfferLetterSchema = z
    .object({
        message: z.string().optional(), // Custom message to include in email
    })
    .openapi('SendOfferLetter');

export type SendOfferLetterInput = z.infer<typeof SendOfferLetterSchema>;

// Record signature (customer signs the offer letter)
export const SignOfferLetterSchema = z
    .object({
        signatureMethod: z.enum(['CLICK_TO_SIGN', 'DRAW', 'UPLOAD']).default('CLICK_TO_SIGN'),
        signatureData: z.string().optional(), // Base64 signature image for DRAW/UPLOAD
        agreedToTerms: z.boolean().refine((val) => val === true, {
            message: 'You must agree to the terms',
        }),
    })
    .openapi('SignOfferLetter');

export type SignOfferLetterInput = z.infer<typeof SignOfferLetterSchema>;

// Update offer letter (for PDF URL after generation)
export const UpdateOfferLetterSchema = z
    .object({
        pdfUrl: z.string().url().optional(),
        pdfKey: z.string().optional(),
        status: z.enum(['DRAFT', 'GENERATED', 'SENT', 'VIEWED', 'SIGNED', 'EXPIRED', 'CANCELLED']).optional(),
    })
    .openapi('UpdateOfferLetter');

export type UpdateOfferLetterInput = z.infer<typeof UpdateOfferLetterSchema>;

// Cancel offer letter
export const CancelOfferLetterSchema = z
    .object({
        reason: z.string().min(1).max(500),
    })
    .openapi('CancelOfferLetter');

export type CancelOfferLetterInput = z.infer<typeof CancelOfferLetterSchema>;

// List offer letters query params
export const ListOfferLettersSchema = z
    .object({
        applicationId: z.string().optional(),
        type: z.enum(['PROVISIONAL', 'FINAL']).optional(),
        status: z.enum(['DRAFT', 'GENERATED', 'SENT', 'VIEWED', 'SIGNED', 'EXPIRED', 'CANCELLED']).optional(),
    })
    .openapi('ListOfferLetters');

export type ListOfferLettersInput = z.infer<typeof ListOfferLettersSchema>;
