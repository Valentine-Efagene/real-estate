import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { ApplicationTrigger } from '@valentine-efagene/qshelter-common';

extendZodWithOpenApi(z);

// Create application from payment method
export const CreateApplicationSchema = z
    .object({
        propertyUnitId: z.string(),
        buyerId: z.string().optional(), // Will use x-user-id header if not provided
        sellerId: z.string().optional(),
        paymentMethodId: z.string(),
        title: z.string().min(1).max(200).openapi({ example: 'Purchase Agreement - Unit A1' }),
        description: z.string().optional(),
        applicationType: z.string().min(1).max(50).openapi({ example: 'MORTGAGE' }),
        totalAmount: z.number().positive().optional().openapi({ example: 500000 }), // If not provided, uses unit price
        downPayment: z.number().min(0).optional().openapi({ example: 50000 }),
        startDate: z.string().datetime().optional(),
        // Flexible-term mortgage fields
        selectedMortgageTermMonths: z.number().positive().optional().openapi({
            example: 240,
            description: 'User-selected mortgage term in months (for flexible-term plans)'
        }),
        applicantAge: z.number().positive().optional().openapi({
            example: 35,
            description: 'Applicant age for max-age-at-maturity validation'
        }),
        monthlyIncome: z.number().min(0).optional().openapi({ example: 2500000, description: 'Monthly income for DTI calculation' }),
        monthlyExpenses: z.number().min(0).optional().openapi({ example: 800000, description: 'Monthly expenses for DTI calculation' }),
    })
    .openapi('CreateApplication');

export const UpdateApplicationSchema = z
    .object({
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'TERMINATED']).optional(),
    })
    .openapi('UpdateApplication');

// Transition application state
export const TransitionApplicationSchema = z
    .object({
        trigger: z.nativeEnum(ApplicationTrigger).optional().openapi({ example: 'SUBMIT' }),
        action: z.nativeEnum(ApplicationTrigger).optional().openapi({ example: 'SUBMIT' }),
        note: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
    })
    .transform((data) => ({
        ...data,
        trigger: data.trigger || data.action!, // Normalize action to trigger
    }))
    .openapi('TransitionApplication');

// Sign application
export const SignApplicationSchema = z
    .object({
        signedAt: z.string().datetime().optional(),
    })
    .openapi('SignApplication');

export const ApplicationResponseSchema = z
    .object({
        id: z.string(),
        propertyUnitId: z.string(),
        buyerId: z.string(),
        sellerId: z.string().nullable(),
        paymentMethodId: z.string().nullable(),
        applicationNumber: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        applicationType: z.string(),
        totalAmount: z.number(),
        downPayment: z.number(),
        downPaymentPaid: z.number(),
        principal: z.number().nullable(),
        totalPaidToDate: z.number(),
        totalInterestPaid: z.number(),
        status: z.string(),
        state: z.string(),
        currentPhaseId: z.string().nullable(),
        createdAt: z.date(),
        updatedAt: z.date(),
        phases: z.array(z.any()).optional(),
    })
    .openapi('ApplicationResponse');

export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;
export type TransitionApplicationInput = z.infer<typeof TransitionApplicationSchema>;
export type SignApplicationInput = z.infer<typeof SignApplicationSchema>;
