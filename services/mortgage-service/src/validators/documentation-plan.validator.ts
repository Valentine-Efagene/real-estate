import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Step type enum (matches Prisma StepType)
export const StepTypeEnum = z.enum(['UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT', 'GENERATE_DOCUMENT']);

// Step definition schema for documentation plans
export const DocumentationPlanStepSchema = z.object({
    name: z.string().min(1).openapi({ example: 'Upload Valid ID' }),
    stepType: StepTypeEnum.openapi({ example: 'UPLOAD' }),
    order: z.number().int().min(1).openapi({ example: 1 }),
    documentType: z.string().optional().openapi({ example: 'ID_CARD', description: 'Document type this step handles (for UPLOAD steps)' }),
    metadata: z.record(z.string(), z.any()).optional(),
}).openapi('DocumentationPlanStep');

// Create documentation plan input schema
export const CreateDocumentationPlanSchema = z.object({
    name: z.string().min(1).max(100).openapi({ example: 'Standard KYC' }),
    description: z.string().optional().openapi({ example: 'Standard KYC workflow with ID, bank statement, and employment letter' }),
    isActive: z.boolean().default(true),
    requiredDocumentTypes: z.array(z.string()).optional().openapi({
        example: ['ID_CARD', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER'],
        description: 'Document types required for this plan'
    }),
    steps: z.array(DocumentationPlanStepSchema).min(1).openapi({ description: 'Steps in this documentation workflow' }),
}).openapi('CreateDocumentationPlanInput');

export type CreateDocumentationPlanInput = z.infer<typeof CreateDocumentationPlanSchema>;

// Update documentation plan input schema
export const UpdateDocumentationPlanSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    requiredDocumentTypes: z.array(z.string()).optional(),
}).openapi('UpdateDocumentationPlanInput');

export type UpdateDocumentationPlanInput = z.infer<typeof UpdateDocumentationPlanSchema>;

// Add step to plan schema
export const AddStepToPlanSchema = DocumentationPlanStepSchema.openapi('AddStepToPlanInput');

export type AddStepToPlanInput = z.infer<typeof AddStepToPlanSchema>;
