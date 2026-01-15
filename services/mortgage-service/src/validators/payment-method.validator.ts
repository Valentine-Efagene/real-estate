import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Phase category enum (matches Prisma PhaseCategory)
export const PhaseCategoryEnum = z.enum(['QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT']);

// Phase type enum (matches Prisma PhaseType)
export const PhaseTypeEnum = z.enum(['KYC', 'VERIFICATION', 'DOWNPAYMENT', 'MORTGAGE', 'BALLOON', 'CUSTOM']);

// Step type enum (matches Prisma StepType)
export const StepTypeEnum = z.enum(['UPLOAD', 'REVIEW', 'SIGNATURE', 'APPROVAL', 'EXTERNAL_CHECK', 'WAIT', 'GENERATE_DOCUMENT']);

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
    // Plan references (only one should be set based on phaseCategory)
    paymentPlanId: z.string().optional().openapi({ description: 'Required for PAYMENT phases - references a PaymentPlan' }),
    documentationPlanId: z.string().optional().openapi({ description: 'Optional for DOCUMENTATION phases - references a DocumentationPlan' }),
    questionnairePlanId: z.string().optional().openapi({ description: 'Optional for QUESTIONNAIRE phases - references a QuestionnairePlan for prequalification forms' }),

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
    // Inline step definitions (alternative to using documentationPlanId)
    stepDefinitions: z.array(StepDefinitionSchema).optional().openapi({ description: 'Inline step definitions for DOCUMENTATION phases (alternative to documentationPlanId)' }),
    // Unit locking: when true, completing this phase locks the unit for the applicant and supersedes competing applications
    lockUnitOnComplete: z.boolean().default(false).openapi({
        description: 'When true, completing this phase locks the property unit for the applicant. Other applications for the same unit will be marked as SUPERSEDED.',
        example: false
    }),
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

// ============================================================
// Step CRUD Schemas (for managing individual steps within phases)
// ============================================================

// Create a new step within a phase
export const AddStepSchema = z.object({
    name: z.string().min(1).max(100).openapi({ example: 'Upload ID Document' }),
    stepType: StepTypeEnum.openapi({ example: 'UPLOAD' }),
    order: z.number().int().min(1).openapi({ example: 1, description: 'Order within the phase' }),
    requiredDocumentTypes: z.array(z.string()).optional().openapi({ example: ['ID_CARD', 'PASSPORT'] }),
    metadata: z.record(z.string(), z.any()).optional().openapi({ description: 'Additional step configuration' }),
}).openapi('AddStep');

// Update an existing step
export const UpdateStepSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    stepType: StepTypeEnum.optional(),
    order: z.number().int().min(1).optional(),
    requiredDocumentTypes: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
}).openapi('UpdateStep');

// Reorder steps within a phase
export const ReorderStepsSchema = z.object({
    stepOrders: z.array(z.object({
        stepId: z.string(),
        order: z.number().int().min(1),
    })).min(1),
}).openapi('ReorderSteps');

// ============================================================
// Document Requirement CRUD Schemas
// ============================================================

// Create a new document requirement within a phase
export const AddDocumentRequirementSchema = DocumentRequirementSchema.openapi('AddDocumentRequirement');

// Update an existing document requirement
export const UpdateDocumentRequirementSchema = z.object({
    documentType: z.string().min(1).optional(),
    isRequired: z.boolean().optional(),
    description: z.string().optional(),
    allowedMimeTypes: z.array(z.string()).optional(),
    maxSizeBytes: z.number().int().positive().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
}).openapi('UpdateDocumentRequirement');

// ============================================================
// Clone Template Schema
// ============================================================

export const ClonePaymentMethodSchema = z.object({
    name: z.string().min(1).max(100).openapi({ example: 'Standard Mortgage (Copy)' }),
    description: z.string().optional(),
}).openapi('ClonePaymentMethod');

// ============================================================
// Bulk Document Requirement Rules Schema
// ============================================================

export const DocumentRequirementRuleSchema = z.object({
    context: z.enum(['PREQUALIFICATION', 'APPLICATION_PHASE', 'PAYMENT_METHOD_CHANGE']).default('APPLICATION_PHASE'),
    phaseType: z.string().optional().openapi({ example: 'KYC' }),
    documentType: z.string().min(1).openapi({ example: 'ID_CARD' }),
    isRequired: z.boolean().default(true),
    description: z.string().optional().openapi({ example: 'Valid government-issued ID' }),
    maxSizeBytes: z.number().int().positive().optional().openapi({ example: 5242880 }),
    allowedMimeTypes: z.array(z.string()).optional().openapi({ example: ['application/pdf', 'image/jpeg'] }),
    expiryDays: z.number().int().positive().optional().openapi({ example: 90 }),
    requiresManualReview: z.boolean().default(false),
}).openapi('DocumentRequirementRule');

export const BulkDocumentRulesSchema = z.object({
    rules: z.array(DocumentRequirementRuleSchema).min(1),
}).openapi('BulkDocumentRules');

// ============================================================
// Event Attachment Schemas
// ============================================================

// Phase trigger enum (matches Prisma PhaseTrigger)
export const PhaseTriggerEnum = z.enum([
    'ON_ACTIVATE',
    'ON_COMPLETE',
    'ON_CANCEL',
    'ON_PAYMENT_RECEIVED',
    'ON_ALL_PAYMENTS_RECEIVED',
]).openapi('PhaseTrigger');

// Step trigger enum (matches Prisma StepTrigger)
export const StepTriggerEnum = z.enum([
    'ON_COMPLETE',
    'ON_REJECT',
    'ON_SUBMIT',
    'ON_RESUBMIT',
    'ON_START',
]).openapi('StepTrigger');

// Add phase event attachment
export const AddPhaseEventAttachmentSchema = z.object({
    trigger: PhaseTriggerEnum.openapi({ example: 'ON_COMPLETE' }),
    handlerId: z.string().cuid().openapi({ description: 'ID of the event handler to attach' }),
    priority: z.number().int().min(0).max(1000).default(100).openapi({ example: 100 }),
    enabled: z.boolean().default(true),
}).openapi('AddPhaseEventAttachment');

// Update phase event attachment
export const UpdatePhaseEventAttachmentSchema = AddPhaseEventAttachmentSchema.partial().openapi('UpdatePhaseEventAttachment');

// Add step event attachment
export const AddStepEventAttachmentSchema = z.object({
    trigger: StepTriggerEnum.openapi({ example: 'ON_COMPLETE' }),
    handlerId: z.string().cuid().openapi({ description: 'ID of the event handler to attach' }),
    priority: z.number().int().min(0).max(1000).default(100).openapi({ example: 100 }),
    enabled: z.boolean().default(true),
}).openapi('AddStepEventAttachment');

// Update step event attachment
export const UpdateStepEventAttachmentSchema = AddStepEventAttachmentSchema.partial().openapi('UpdateStepEventAttachment');

// Type exports
export type CreatePaymentMethodInput = z.infer<typeof CreatePaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof UpdatePaymentMethodSchema>;
export type AddPhaseInput = z.infer<typeof AddPhaseSchema>;
export type LinkToPropertyInput = z.infer<typeof LinkToPropertySchema>;
export type AddStepInput = z.infer<typeof AddStepSchema>;
export type UpdateStepInput = z.infer<typeof UpdateStepSchema>;
export type ReorderStepsInput = z.infer<typeof ReorderStepsSchema>;
export type AddDocumentRequirementInput = z.infer<typeof AddDocumentRequirementSchema>;
export type UpdateDocumentRequirementInput = z.infer<typeof UpdateDocumentRequirementSchema>;
export type ClonePaymentMethodInput = z.infer<typeof ClonePaymentMethodSchema>;
export type AddPhaseEventAttachmentInput = z.infer<typeof AddPhaseEventAttachmentSchema>;
export type UpdatePhaseEventAttachmentInput = z.infer<typeof UpdatePhaseEventAttachmentSchema>;
export type AddStepEventAttachmentInput = z.infer<typeof AddStepEventAttachmentSchema>;
export type UpdateStepEventAttachmentInput = z.infer<typeof UpdateStepEventAttachmentSchema>;
export type DocumentRequirementRuleInput = z.infer<typeof DocumentRequirementRuleSchema>;
export type BulkDocumentRulesInput = z.infer<typeof BulkDocumentRulesSchema>;
