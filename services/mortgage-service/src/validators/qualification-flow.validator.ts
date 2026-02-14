import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Phase category enum (only QUESTIONNAIRE, DOCUMENTATION, GATE — no PAYMENT)
const QualificationPhaseCategoryEnum = z.enum(['QUESTIONNAIRE', 'DOCUMENTATION', 'GATE']);

// Phase type enum subset relevant to qualification flows
const QualificationPhaseTypeEnum = z.enum([
    'PRE_APPROVAL',
    'UNDERWRITING',
    'KYC',
    'VERIFICATION',
    'APPROVAL_GATE',
    'ORG_KYB',
]);

// Qualification status enum
const QualificationStatusEnum = z.enum([
    'PENDING',
    'IN_PROGRESS',
    'QUALIFIED',
    'REJECTED',
    'SUSPENDED',
    'EXPIRED',
]);

// =============================================================================
// QUALIFICATION FLOW TEMPLATES
// =============================================================================

const QualificationFlowPhaseSchema = z.object({
    questionnairePlanId: z.string().optional().openapi({ description: 'For QUESTIONNAIRE phases' }),
    documentationPlanId: z.string().optional().openapi({ description: 'For DOCUMENTATION phases' }),
    gatePlanId: z.string().optional().openapi({ description: 'For GATE phases' }),
    name: z.string().min(1).max(100).openapi({ example: 'Developer Eligibility Questionnaire' }),
    description: z.string().optional(),
    phaseCategory: QualificationPhaseCategoryEnum.openapi({ example: 'QUESTIONNAIRE' }),
    phaseType: QualificationPhaseTypeEnum.openapi({ example: 'PRE_APPROVAL' }),
    order: z.number().int().min(1).openapi({ example: 1 }),
    requiresPreviousPhaseCompletion: z.boolean().default(true),
}).openapi('QualificationFlowPhaseInput');

export const CreateQualificationFlowSchema = z.object({
    name: z.string().min(1).max(200).openapi({ example: 'MREIF Developer Qualification' }),
    description: z.string().optional().openapi({ example: 'Qualification workflow for organizations to access the MREIF payment method' }),
    isActive: z.boolean().default(true),
    autoActivatePhases: z.boolean().default(true),
    expiresInDays: z.number().int().min(1).optional().openapi({ example: 90 }),
    phases: z.array(QualificationFlowPhaseSchema).min(1).openapi({
        description: 'Ordered phases that make up this qualification flow',
    }),
}).openapi('CreateQualificationFlow');

export const UpdateQualificationFlowSchema = CreateQualificationFlowSchema.partial().openapi('UpdateQualificationFlow');

// =============================================================================
// PAYMENT METHOD QUALIFICATION — Org applies to use a payment method
// =============================================================================

export const ApplyForPaymentMethodSchema = z.object({
    organizationId: z.string().min(1).openapi({ example: 'clorg123', description: 'Organization applying for access' }),
    notes: z.string().optional().openapi({ example: 'Lekki Gardens applying for MREIF access' }),
}).openapi('ApplyForPaymentMethod');

export const ReviewQualificationSchema = z.object({
    decision: z.enum(['APPROVED', 'REJECTED']).openapi({ example: 'APPROVED' }),
    notes: z.string().optional().openapi({ example: 'Organization meets all eligibility criteria' }),
}).openapi('ReviewQualification');

export const UpdateQualificationStatusSchema = z.object({
    status: QualificationStatusEnum.openapi({ example: 'SUSPENDED' }),
    notes: z.string().optional(),
}).openapi('UpdateQualificationStatus');

// Assign qualification flow to a payment method for a specific org type
export const AssignQualificationFlowSchema = z.object({
    qualificationFlowId: z.string().min(1).openapi({ example: 'clflow123', description: 'ID of the qualification flow template' }),
    organizationTypeCode: z.string().min(1).openapi({ example: 'DEVELOPER', description: 'Organization type code this flow applies to (e.g., DEVELOPER, BANK)' }),
}).openapi('AssignQualificationFlow');

// Document waiver — org marks a document as optional for their use of a payment method
export const CreateDocumentWaiverSchema = z.object({
    documentDefinitionId: z.string().min(1).openapi({ example: 'cldocdef123', description: 'ID of the document definition to waive' }),
    reason: z.string().optional().openapi({ example: 'Access Bank does not require proof of address for standard mortgage applications' }),
}).openapi('CreateDocumentWaiver');

// Bulk document waiver — waive multiple documents at once
export const BulkCreateDocumentWaiverSchema = z.object({
    waivers: z.array(CreateDocumentWaiverSchema).min(1).openapi({ description: 'List of document waivers to create' }),
}).openapi('BulkCreateDocumentWaiver');

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateQualificationFlowInput = z.infer<typeof CreateQualificationFlowSchema>;
export type UpdateQualificationFlowInput = z.infer<typeof UpdateQualificationFlowSchema>;
export type ApplyForPaymentMethodInput = z.infer<typeof ApplyForPaymentMethodSchema>;
export type ReviewQualificationInput = z.infer<typeof ReviewQualificationSchema>;
export type UpdateQualificationStatusInput = z.infer<typeof UpdateQualificationStatusSchema>;
export type AssignQualificationFlowInput = z.infer<typeof AssignQualificationFlowSchema>;
export type CreateDocumentWaiverInput = z.infer<typeof CreateDocumentWaiverSchema>;
export type BulkCreateDocumentWaiverInput = z.infer<typeof BulkCreateDocumentWaiverSchema>;
