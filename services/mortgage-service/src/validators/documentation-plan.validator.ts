import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Step type enum (matches Prisma StepType)
export const StepTypeEnum = z.enum(['UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT', 'GENERATE_DOCUMENT']);

// Condition operator enum for conditional document requirements
export const ConditionOperatorEnum = z.enum([
    'EQUALS',
    'NOT_EQUALS',
    'IN',
    'NOT_IN',
    'GREATER_THAN',
    'LESS_THAN',
    'EXISTS',
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorEnum>;

// Condition schema for conditional document requirements
export const StepConditionSchema = z.object({
    questionKey: z.string().optional().openapi({ example: 'mortgage_type', description: 'The questionnaire question key to evaluate' }),
    operator: ConditionOperatorEnum.optional().openapi({ example: 'EQUALS', description: 'Comparison operator' }),
    value: z.union([z.string(), z.number(), z.boolean()]).optional().openapi({ example: 'JOINT', description: 'Value to compare against (for EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN)' }),
    values: z.array(z.union([z.string(), z.number()])).optional().openapi({ example: ['SELF_EMPLOYED', 'BUSINESS_OWNER'], description: 'Values to compare against (for IN, NOT_IN)' }),
    all: z.array(z.lazy(() => StepConditionSchema)).optional().openapi({ description: 'All conditions must be true (AND logic)' }),
    any: z.array(z.lazy(() => StepConditionSchema)).optional().openapi({ description: 'Any condition must be true (OR logic)' }),
}).openapi('StepCondition');
export type StepCondition = z.infer<typeof StepConditionSchema>;

// Step definition schema for documentation plans
export const DocumentationPlanStepSchema = z.object({
    name: z.string().min(1).openapi({ example: 'Upload Valid ID' }),
    stepType: StepTypeEnum.openapi({ example: 'UPLOAD' }),
    order: z.number().int().min(1).openapi({ example: 1 }),
    documentType: z.string().optional().openapi({ example: 'ID_CARD', description: 'Document type this step handles (for UPLOAD steps)' }),
    metadata: z.record(z.string(), z.any()).optional(),

    // Document validation rules (for UPLOAD steps)
    isRequired: z.boolean().default(true).openapi({ description: 'Whether this document is required' }),
    description: z.string().optional().openapi({ example: 'Valid government-issued ID (NIN, Passport, or Driver License)', description: 'Instructions for the user' }),
    maxSizeBytes: z.number().int().positive().optional().openapi({ example: 5242880, description: 'Max file size allowed in bytes (e.g., 5242880 for 5MB)' }),
    allowedMimeTypes: z.array(z.string()).optional().openapi({ example: ['application/pdf', 'image/jpeg', 'image/png'], description: 'Allowed MIME types for uploads' }),
    expiryDays: z.number().int().positive().optional().openapi({ example: 90, description: 'Document must not be older than X days' }),
    requiresManualReview: z.boolean().default(false).openapi({ description: 'Whether admin must manually review this document' }),
    minFiles: z.number().int().min(1).default(1).openapi({ example: 1, description: 'Minimum number of files required' }),
    maxFiles: z.number().int().min(1).default(1).openapi({ example: 3, description: 'Maximum number of files allowed' }),

    // Conditional logic - when is this step required based on questionnaire answers?
    // NULL = always required (unconditional)
    condition: StepConditionSchema.optional().openapi({
        description: 'Condition that determines when this step is required. If null, step is always required. Evaluated against questionnaire answers.',
        example: { questionKey: 'mortgage_type', operator: 'EQUALS', value: 'JOINT' }
    }),
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
