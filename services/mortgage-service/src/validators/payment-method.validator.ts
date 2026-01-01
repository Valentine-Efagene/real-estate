import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Phase category enum
export const PhaseCategory = z.enum(['DOCUMENTATION', 'PAYMENT']);

// Step definition schema for DOCUMENTATION phases
export const StepDefinitionSchema = z.object({
    name: z.string().min(1).openapi({ example: 'Upload ID' }),
    stepType: z.enum(['UPLOAD', 'APPROVAL', 'VERIFICATION', 'SIGNATURE']).openapi({ example: 'UPLOAD' }),
    order: z.number().int().min(1).openapi({ example: 1 }),
    requiredDocumentTypes: z.array(z.string()).optional().openapi({ example: ['ID_CARD'] }),
}).openapi('StepDefinition');

// Phase template schema (for creating phases within a payment method)
export const PaymentMethodPhaseSchema = z
    .object({
        paymentPlanId: z.string().optional().openapi({ description: 'Required for PAYMENT phases' }),
        name: z.string().min(1).max(100).openapi({ example: 'KYC Verification' }),
        description: z.string().optional(),
        phaseCategory: PhaseCategory.openapi({ example: 'DOCUMENTATION' }),
        phaseType: z.string().min(1).max(50).openapi({ example: 'KYC' }),
        order: z.number().int().min(0).openapi({ example: 1 }),
        interestRate: z.number().min(0).max(100).optional().openapi({ example: 5.5 }),
        percentOfPrice: z.number().min(0).max(100).optional().openapi({ example: 10 }),
        requiresPreviousPhaseCompletion: z.boolean().default(true),
        minimumCompletionPercentage: z.number().min(0).max(100).optional(),
        requiredDocumentTypes: z.array(z.string()).optional().openapi({ example: ['ID_CARD', 'BANK_STATEMENT', 'PROOF_OF_INCOME'] }),
        stepDefinitions: z.array(StepDefinitionSchema).optional().openapi({ description: 'Step definitions for DOCUMENTATION phases' }),
    })
    .openapi('PaymentMethodPhase');

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
