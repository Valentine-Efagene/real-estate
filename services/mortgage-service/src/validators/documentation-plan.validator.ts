import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { UploadedBy, RejectionBehavior } from '@valentine-efagene/qshelter-common';

extendZodWithOpenApi(z);

// =============================================================================
// CONDITION SCHEMA - For conditional document requirements
// =============================================================================

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

export const StepConditionSchema: z.ZodType<StepCondition> = z.object({
    questionKey: z.string().optional().openapi({ example: 'mortgage_type', description: 'The questionnaire question key to evaluate' }),
    operator: ConditionOperatorEnum.optional().openapi({ example: 'EQUALS', description: 'Comparison operator' }),
    value: z.union([z.string(), z.number(), z.boolean()]).optional().openapi({ example: 'JOINT', description: 'Value to compare against (for EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN)' }),
    values: z.array(z.union([z.string(), z.number()])).optional().openapi({ example: ['SELF_EMPLOYED', 'BUSINESS_OWNER'], description: 'Values to compare against (for IN, NOT_IN)' }),
    all: z.array(z.lazy(() => StepConditionSchema)).optional().openapi({ description: 'All conditions must be true (AND logic)' }),
    any: z.array(z.lazy(() => StepConditionSchema)).optional().openapi({ description: 'Any condition must be true (OR logic)' }),
}).openapi('StepCondition');

export type StepCondition = {
    questionKey?: string;
    operator?: ConditionOperator;
    value?: string | number | boolean;
    values?: (string | number)[];
    all?: StepCondition[];
    any?: StepCondition[];
};

// =============================================================================
// DOCUMENT DEFINITION SCHEMA - What documents to collect
// =============================================================================

export const UploadedByEnum = z.nativeEnum(UploadedBy);
export const RejectionBehaviorEnum = z.nativeEnum(RejectionBehavior);

export const DocumentDefinitionSchema = z.object({
    documentType: z.string().min(1).openapi({ example: 'ID_CARD', description: 'Document type identifier' }),
    documentName: z.string().min(1).openapi({ example: 'Valid ID Card', description: 'Human-readable name' }),
    uploadedBy: UploadedByEnum.default('CUSTOMER').openapi({ example: 'CUSTOMER', description: 'Who uploads this document' }),
    order: z.number().int().min(1).openapi({ example: 1, description: 'Display order' }),

    // Validation rules
    isRequired: z.boolean().default(true).openapi({ description: 'Whether this document is required' }),
    description: z.string().optional().openapi({ example: 'Valid government-issued ID', description: 'Instructions for uploader' }),
    maxSizeBytes: z.number().int().positive().optional().openapi({ example: 5242880, description: 'Max file size in bytes' }),
    allowedMimeTypes: z.array(z.string()).optional().openapi({ example: ['application/pdf', 'image/jpeg'], description: 'Allowed MIME types' }),
    expiryDays: z.number().int().positive().optional().openapi({ example: 90, description: 'Document must not be older than X days' }),
    minFiles: z.number().int().min(1).default(1).openapi({ example: 1, description: 'Minimum number of files' }),
    maxFiles: z.number().int().min(1).default(1).openapi({ example: 3, description: 'Maximum number of files' }),

    // Conditional logic
    condition: StepConditionSchema.optional().openapi({
        description: 'When is this document required? NULL = always required.',
        example: { questionKey: 'mortgage_type', operator: 'EQUALS', value: 'JOINT' }
    }),
}).openapi('DocumentDefinition');

export type DocumentDefinitionInput = z.infer<typeof DocumentDefinitionSchema>;

// =============================================================================
// APPROVAL STAGE SCHEMA - Sequential approval workflow
// =============================================================================

export const ApprovalStageSchema = z.object({
    name: z.string().min(1).openapi({ example: 'QShelter Staff Review', description: 'Stage name' }),
    order: z.number().int().min(1).openapi({ example: 1, description: 'Sequential order (1, 2, 3...)' }),
    organizationTypeCode: z.string().min(1).openapi({ example: 'PLATFORM', description: 'Organization type code (PLATFORM, BANK, DEVELOPER, etc.)' }),

    // Behavior flags
    autoTransition: z.boolean().default(false).openapi({ description: 'Auto-complete when all docs approved? Default: require explicit approval' }),
    waitForAllDocuments: z.boolean().default(true).openapi({ description: 'Wait for all docs approved before allowing transition' }),
    allowEarlyVisibility: z.boolean().default(false).openapi({ description: 'Allow read-only view before stage activates' }),

    // Rejection behavior
    onRejection: RejectionBehaviorEnum.default('CASCADE_BACK').openapi({ example: 'CASCADE_BACK', description: 'What happens when this stage rejects' }),
    restartFromStageOrder: z.number().int().min(1).optional().openapi({ description: 'If onRejection=RESTART_FROM_STAGE, which stage to restart from' }),

    // Optional specific organization
    organizationId: z.string().optional().openapi({ description: 'Specific organization for this review (e.g., which bank)' }),

    // SLA
    slaHours: z.number().int().positive().optional().openapi({ example: 48, description: 'Escalate if not completed within X hours' }),

    description: z.string().optional().openapi({ description: 'Instructions for reviewers' }),
}).openapi('ApprovalStage');

export type ApprovalStageInput = z.infer<typeof ApprovalStageSchema>;

// =============================================================================
// CREATE/UPDATE DOCUMENTATION PLAN SCHEMAS
// =============================================================================

export const CreateDocumentationPlanSchema = z.object({
    name: z.string().min(1).max(100).openapi({ example: 'Mortgage KYC Documentation' }),
    description: z.string().optional().openapi({ example: 'Standard KYC workflow for mortgage applications' }),
    isActive: z.boolean().default(true),

    // Document definitions (what documents to collect)
    documentDefinitions: z.array(DocumentDefinitionSchema).min(1).openapi({
        description: 'Documents to collect in this plan'
    }),

    // Approval stages (sequential review workflow)
    approvalStages: z.array(ApprovalStageSchema).min(1).openapi({
        description: 'Sequential approval stages (e.g., QShelter Review → Bank Review)'
    }),
}).openapi('CreateDocumentationPlanInput');

export type CreateDocumentationPlanInput = z.infer<typeof CreateDocumentationPlanSchema>;

export const UpdateDocumentationPlanSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
}).openapi('UpdateDocumentationPlanInput');

export type UpdateDocumentationPlanInput = z.infer<typeof UpdateDocumentationPlanSchema>;

// =============================================================================
// ADD/UPDATE DOCUMENT DEFINITION SCHEMAS
// =============================================================================

export const AddDocumentDefinitionSchema = DocumentDefinitionSchema.openapi('AddDocumentDefinitionInput');
export type AddDocumentDefinitionInput = z.infer<typeof AddDocumentDefinitionSchema>;

// =============================================================================
// ADD/UPDATE APPROVAL STAGE SCHEMAS
// =============================================================================

export const AddApprovalStageSchema = ApprovalStageSchema.openapi('AddApprovalStageInput');
export type AddApprovalStageInput = z.infer<typeof AddApprovalStageSchema>;

