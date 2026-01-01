import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Phase category enum (matches Prisma PhaseCategory)
export const PhaseCategoryEnum = z.enum(['DOCUMENTATION', 'PAYMENT']);

// Phase type enum (matches Prisma PhaseType)
export const PhaseTypeEnum = z.enum(['KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'CUSTOM']);

// Step type enum (matches Prisma StepType)
export const StepTypeEnum = z.enum(['UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT']);

// Step definition schema for DOCUMENTATION phases
export const StepDefinitionSchema = z.object({
    name: z.string().min(1).openapi({ example: 'Upload ID' }),
    stepType: StepTypeEnum.openapi({ example: 'UPLOAD' }),
    order: z.number().int().min(1).openapi({ example: 1 }),
    requiredDocumentTypes: z.array(z.string()).optional().openapi({ example: ['ID_CARD'] }),
    metadata: z.record(z.string(), z.any()).optional(),
}).openapi('StepDefinition');

// Document requirement schema for DOCUMENTATION phases
export const DocumentRequirementSchema = z.object({
    documentType: z.string().min(1).openapi({ example: 'ID_CARD' }),
    isRequired: z.boolean().default(true),
    description: z.string().optional(),
    allowedMimeTypes: z.array(z.string()).optional().openapi({ example: ['application/pdf', 'image/jpeg'] }),
    maxSizeBytes: z.number().int().positive().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
}).openapi('DocumentRequirement');

// Phase template base schema (without transform for partial to work)
const PaymentMethodPhaseBaseSchema = z.object({
    paymentPlanId: z.string().optional().openapi({ description: 'Required for PAYMENT phases' }),
    name: z.string().min(1).max(100).openapi({ example: 'KYC Verification' }),
    description: z.string().optional(),
    phaseCategory: PhaseCategoryEnum.openapi({ example: 'DOCUMENTATION' }),
    phaseType: PhaseTypeEnum.openapi({ example: 'KYC' }),
    order: z.number().int().min(0).openapi({ example: 1 }),
    interestRate: z.number().min(0).max(100).optional().openapi({ example: 5.5 }),
    percentOfPrice: z.number().min(0).max(100).optional().openapi({ example: 10 }),
    // Fund collection behavior (overrides PaymentPlan.collectFunds if set)
    // true = we collect funds via wallet/gateway (e.g., downpayment)
    // false = external payment, we only track/reconcile (e.g., bank mortgage)
    // null/undefined = inherit from PaymentPlan
    collectFunds: z.boolean().optional().openapi({ example: true, description: 'Whether we collect funds (null = inherit from PaymentPlan)' }),
    requiresPreviousPhaseCompletion: z.boolean().default(true),
    minimumCompletionPercentage: z.number().min(0).max(100).optional(),
    // New normalized format for required documents
    requiredDocuments: z.array(DocumentRequirementSchema).optional().openapi({ description: 'Required documents for DOCUMENTATION phases' }),
    // Legacy format for backward compatibility (will be converted to requiredDocuments)
    requiredDocumentTypes: z.array(z.string()).optional().openapi({ description: 'Legacy: array of document type strings' }),
    stepDefinitions: z.array(StepDefinitionSchema).optional().openapi({ description: 'Step definitions for DOCUMENTATION phases' }),
});

// Function to transform legacy requiredDocumentTypes to requiredDocuments
function transformPhaseData<T extends { requiredDocuments?: any[]; requiredDocumentTypes?: string[] }>(data: T) {
    if (!data.requiredDocuments && data.requiredDocumentTypes && data.requiredDocumentTypes.length > 0) {
        return {
            ...data,
            requiredDocuments: data.requiredDocumentTypes.map((docType) => ({
                documentType: docType,
                isRequired: true,
            })),
        };
    }
    return data;
}

// Phase template schema (for creating phases within a payment method)
export const PaymentMethodPhaseSchema = PaymentMethodPhaseBaseSchema
    .transform(transformPhaseData)
    .openapi('PaymentMethodPhase');

// Partial phase schema for updates (uses base schema)
export const PartialPhaseSchema = PaymentMethodPhaseBaseSchema.partial()
    .transform(transformPhaseData)
    .openapi('PartialPhase');

// Create payment method schema
export const CreatePaymentMethodSchema = z
    .object({
        name: z.string().min(1).max(100).openapi({ example: 'Standard Mortgage' }),
        description: z.string().optional(),
        isActive: z.boolean().default(true),
        allowEarlyPayoff: z.boolean().default(true),
        earlyPayoffPenaltyRate: z.number().min(0).max(100).optional(),
        autoActivatePhases: z.boolean().default(true),
        requiresManualApproval: z.boolean().default(false),
        phases: z.array(PaymentMethodPhaseSchema).optional().openapi({ description: 'Phase templates for this method' }),
    })
    .openapi('CreatePaymentMethod');

export const UpdatePaymentMethodSchema = CreatePaymentMethodSchema.partial().openapi('UpdatePaymentMethod');

// Add phase to existing method
export const AddPhaseSchema = PaymentMethodPhaseSchema.openapi('AddPhase');

// Link payment method to property
export const LinkToPropertySchema = z
    .object({
        propertyId: z.string(),
        isDefault: z.boolean().default(false),
        isActive: z.boolean().default(true),
    })
    .openapi('LinkToProperty');

export const PaymentMethodResponseSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
        isActive: z.boolean(),
        allowEarlyPayoff: z.boolean(),
        earlyPayoffPenaltyRate: z.number().nullable(),
        autoActivatePhases: z.boolean(),
        requiresManualApproval: z.boolean(),
        createdAt: z.date(),
        updatedAt: z.date(),
        phases: z.array(z.any()).optional(),
    })
    .openapi('PaymentMethodResponse');

export type CreatePaymentMethodInput = z.infer<typeof CreatePaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof UpdatePaymentMethodSchema>;
export type AddPhaseInput = z.infer<typeof AddPhaseSchema>;
export type LinkToPropertyInput = z.infer<typeof LinkToPropertySchema>;
