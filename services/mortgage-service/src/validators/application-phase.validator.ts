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
        stepId: z.string().optional(),
        stepName: z.string().optional(),
        decision: z.enum(['APPROVED', 'REJECTED', 'REQUEST_CHANGES']).optional(),
        comment: z.string().optional(),
    })
    .openapi('CompleteStep');

// Upload document for a step
export const UploadDocumentSchema = z
    .object({
        stepId: z.string().optional(),
        name: z.string().min(1).max(200).optional(),
        documentType: z.string().optional(),
        url: z.string().url(),
        type: z.string().min(1).max(50).optional().openapi({ example: 'ID' }),
        fileName: z.string().optional(),
    })
    .transform((data) => ({
        ...data,
        name: data.name || data.fileName || 'Document',
        type: data.type || data.documentType || 'OTHER',
    }))
    .openapi('UploadDocument');

// Approve document
export const ApproveDocumentSchema = z
    .object({
        status: z.enum(['APPROVED', 'REJECTED']),
        comment: z.string().optional(),
        note: z.string().optional(),
    })
    .transform((data) => ({
        status: data.status,
        comment: data.comment || data.note,
    }))
    .openapi('ApproveDocument');

// Generate installments for a payment phase
export const GenerateInstallmentsSchema = z
    .object({
        startDate: z.string().datetime(),
        interestRate: z.number().min(0).max(100).optional(),
    })
    .openapi('GenerateInstallments');

// Action status schema - back-end driven UI indicator
export const ActionStatusSchema = z
    .object({
        nextActor: z.enum(['CUSTOMER', 'ADMIN', 'SYSTEM', 'NONE']).openapi({
            description: 'Who needs to take the next action',
            example: 'CUSTOMER',
        }),
        actionCategory: z.enum(['UPLOAD', 'SIGNATURE', 'REVIEW', 'PAYMENT', 'PROCESSING', 'COMPLETED', 'WAITING']).openapi({
            description: 'Category of action required',
            example: 'UPLOAD',
        }),
        actionRequired: z.string().openapi({
            description: 'Human-readable description of what is needed',
            example: 'Upload required: Valid ID Card',
        }),
        progress: z.string().optional().openapi({
            description: 'Additional progress context',
            example: '2 of 3 documents uploaded',
        }),
        dueDate: z.string().datetime().nullable().optional().openapi({
            description: 'When this action is due',
        }),
        isBlocking: z.boolean().optional().openapi({
            description: 'Whether this action is blocking the workflow',
            example: true,
        }),
    })
    .openapi('ActionStatus');

// Step action status schema
export const StepActionStatusSchema = ActionStatusSchema.extend({
    stepId: z.string(),
    stepName: z.string(),
    stepType: z.string(),
    stepOrder: z.number(),
}).openapi('StepActionStatus');

// Phase action status schema
export const PhaseActionStatusSchema = ActionStatusSchema.extend({
    phaseId: z.string(),
    phaseName: z.string(),
    phaseType: z.string(),
    phaseCategory: z.string(),
    currentStep: StepActionStatusSchema.optional().nullable(),
    stepsProgress: z.string().optional(),
    paymentProgress: z.string().optional(),
}).openapi('PhaseActionStatus');

// Phase response
export const ApplicationPhaseResponseSchema = z
    .object({
        id: z.string(),
        applicationId: z.string(),
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
        actionStatus: PhaseActionStatusSchema.optional().openapi({
            description: 'Action status indicator showing who needs to act next',
        }),
    })
    .openapi('ApplicationPhaseResponse');

// Submit questionnaire answers
export const SubmitQuestionnaireSchema = z
    .object({
        answers: z
            .array(
                z.object({
                    fieldName: z.string().min(1).openapi({
                        description: 'The field name (key) to answer',
                        example: 'monthly_income',
                    }),
                    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).openapi({
                        description: 'The answer value',
                        example: '2500000',
                    }),
                })
            )
            .min(1)
            .openapi({
                description: 'Array of field answers',
            }),
    })
    .openapi('SubmitQuestionnaire');

export type ActivatePhaseInput = z.infer<typeof ActivatePhaseSchema>;
export type CompleteStepInput = z.infer<typeof CompleteStepSchema>;
export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;
export type ApproveDocumentInput = z.infer<typeof ApproveDocumentSchema>;
export type GenerateInstallmentsInput = z.infer<typeof GenerateInstallmentsSchema>;
export type SubmitQuestionnaireInput = z.infer<typeof SubmitQuestionnaireSchema>;

// Gate action - for GATE step types
export const GateActionSchema = z
    .object({
        action: z.enum(['APPROVE', 'REJECT', 'ACKNOWLEDGE', 'CONFIRM', 'CONSENT']).openapi({
            description: 'The gate action to perform',
            example: 'APPROVE',
        }),
        comment: z.string().optional().openapi({
            description: 'Optional comment explaining the decision',
            example: 'Approved after reviewing all documents',
        }),
    })
    .openapi('GateAction');

export type GateActionInput = z.infer<typeof GateActionSchema>;
