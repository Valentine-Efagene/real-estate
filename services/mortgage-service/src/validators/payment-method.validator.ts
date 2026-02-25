import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Phase category enum (matches Prisma PhaseCategory)
export const PhaseCategoryEnum = z.enum(['QUESTIONNAIRE', 'DOCUMENTATION', 'PAYMENT']);

// Phase type enum (matches Prisma PhaseType)
export const PhaseTypeEnum = z.enum([
    // QUESTIONNAIRE phases
    'PRE_APPROVAL',
    'UNDERWRITING',
    // DOCUMENTATION phases
    'KYC',
    'VERIFICATION',
    // PAYMENT phases
    'DOWNPAYMENT',
    'MORTGAGE',
    'BALLOON',
    // Generic
    'CUSTOM',
]);

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
    collectFunds: z.boolean().optional().openapi({ example: true, description: 'Whether we collect funds (null = inherit from PaymentPlan)' }),
    requiresPreviousPhaseCompletion: z.boolean().default(true),
    minimumCompletionPercentage: z.number().min(0).max(100).optional(),
    // Unit locking: when true, completing this phase locks the unit for the applicant and supersedes competing applications
    lockUnitOnComplete: z.boolean().default(false).openapi({
        description: 'When true, completing this phase locks the property unit for the applicant. Other applications for the same unit will be marked as SUPERSEDED.',
        example: false
    }),
});

// Phase template schema (for creating phases within a payment method)
export const PaymentMethodPhaseSchema = PaymentMethodPhaseBaseSchema
    .openapi('PaymentMethodPhase');

// Partial phase schema for updates (uses base schema)
export const PartialPhaseSchema = PaymentMethodPhaseBaseSchema.partial()
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

// Add phase event attachment
export const AddPhaseEventAttachmentSchema = z.object({
    trigger: PhaseTriggerEnum.openapi({ example: 'ON_COMPLETE' }),
    handlerId: z.string().cuid().openapi({ description: 'ID of the event handler to attach' }),
    priority: z.number().int().min(0).max(1000).default(100).openapi({ example: 100 }),
    enabled: z.boolean().default(true),
}).openapi('AddPhaseEventAttachment');

// Update phase event attachment
export const UpdatePhaseEventAttachmentSchema = AddPhaseEventAttachmentSchema.partial().openapi('UpdatePhaseEventAttachment');

// Type exports
export type CreatePaymentMethodInput = z.infer<typeof CreatePaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof UpdatePaymentMethodSchema>;
export type AddPhaseInput = z.infer<typeof AddPhaseSchema>;
export type LinkToPropertyInput = z.infer<typeof LinkToPropertySchema>;
export type ClonePaymentMethodInput = z.infer<typeof ClonePaymentMethodSchema>;
export type AddPhaseEventAttachmentInput = z.infer<typeof AddPhaseEventAttachmentSchema>;
export type UpdatePhaseEventAttachmentInput = z.infer<typeof UpdatePhaseEventAttachmentSchema>;
export type DocumentRequirementRuleInput = z.infer<typeof DocumentRequirementRuleSchema>;
export type BulkDocumentRulesInput = z.infer<typeof BulkDocumentRulesSchema>;
