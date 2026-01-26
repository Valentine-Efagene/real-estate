import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Bind an organization to an application
 * Used to assign banks, developers, legal firms, etc. to specific applications
 */
export const BindOrganizationSchema = z
    .object({
        organizationId: z.string().min(1).openapi({
            description: 'ID of the organization to bind',
            example: 'org_access_bank_123',
        }),
        organizationTypeCode: z.string().min(1).openapi({
            description: 'The role this organization plays on this application (e.g., BANK, DEVELOPER, LEGAL)',
            example: 'BANK',
        }),
        isPrimary: z.boolean().default(false).openapi({
            description: 'Whether this is the primary organization for this type (e.g., primary lender)',
            example: true,
        }),
        slaHours: z.number().int().positive().optional().openapi({
            description: 'Expected response time in hours for this organization',
            example: 48,
        }),
    })
    .openapi('BindOrganizationRequest');

/**
 * Update an existing organization binding
 */
export const UpdateOrganizationBindingSchema = z
    .object({
        status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'DECLINED']).optional().openapi({
            description: 'New status for the binding',
            example: 'ACTIVE',
        }),
        isPrimary: z.boolean().optional().openapi({
            description: 'Whether this is the primary organization for this type',
            example: true,
        }),
        slaHours: z.number().int().positive().optional().openapi({
            description: 'Expected response time in hours',
            example: 48,
        }),
        offeredTerms: z.record(z.string(), z.unknown()).optional().openapi({
            description: 'Organization-specific terms (e.g., interest rate, conditions)',
            example: { interestRate: 9.5, termMonths: 240 },
        }),
    })
    .openapi('UpdateOrganizationBindingRequest');

export type BindOrganizationInput = z.infer<typeof BindOrganizationSchema>;
export type UpdateOrganizationBindingInput = z.infer<typeof UpdateOrganizationBindingSchema>;
