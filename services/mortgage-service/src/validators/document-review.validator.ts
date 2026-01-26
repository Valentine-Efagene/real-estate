import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Organization type codes for review parties
 * These match OrganizationType.code values in the database
 * Common values: 'PLATFORM', 'BANK', 'DEVELOPER', 'LEGAL', 'INSURER', 'GOVERNMENT', 'CUSTOMER'
 */
export const OrganizationTypeCodeSchema = z.string().min(1).describe(
    'The organization type code (e.g., PLATFORM, BANK, DEVELOPER, LEGAL, INSURER, GOVERNMENT, CUSTOMER)'
);

/**
 * Review Decision enum
 */
export const ReviewDecisionEnum = z.enum([
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CHANGES_REQUESTED',
    'WAIVED',
]);

/**
 * Review requirement configuration
 */
export const ReviewRequirementSchema = z
    .object({
        organizationTypeCode: OrganizationTypeCodeSchema,
        required: z.boolean().default(true),
        organizationId: z.string().optional(),
    })
    .openapi('ReviewRequirement');

/**
 * Submit document review input
 */
export const SubmitDocumentReviewSchema = z
    .object({
        organizationTypeCode: OrganizationTypeCodeSchema.describe('The organization type code of the reviewing party'),
        decision: ReviewDecisionEnum.exclude(['PENDING', 'WAIVED']).describe(
            'The review decision'
        ),
        comments: z.string().optional().describe('Review comments'),
        concerns: z
            .array(
                z.object({
                    field: z.string().describe('The field or aspect with an issue'),
                    issue: z.string().describe('Description of the issue'),
                })
            )
            .optional()
            .describe('Specific concerns about the document'),
        organizationId: z
            .string()
            .optional()
            .describe('Organization ID if reviewing on behalf of an organization'),
    })
    .openapi('SubmitDocumentReviewInput');

export type SubmitDocumentReviewInput = z.infer<typeof SubmitDocumentReviewSchema>;

/**
 * Waive review input
 */
export const WaiveReviewSchema = z
    .object({
        organizationTypeCode: OrganizationTypeCodeSchema.describe('The organization type code of the party whose review is being waived'),
        organizationId: z.string().nullable().optional().describe('Organization ID if applicable'),
        reason: z.string().min(10).describe('Reason for waiving the review (min 10 chars)'),
    })
    .openapi('WaiveReviewInput');

export type WaiveReviewInput = z.infer<typeof WaiveReviewSchema>;

/**
 * Get pending reviews query params
 */
export const GetPendingReviewsQuerySchema = z.object({
    organizationTypeCode: OrganizationTypeCodeSchema.describe('Filter by organization type code'),
    organizationId: z.string().optional().describe('Filter by organization'),
    applicationId: z.string().optional().describe('Filter by application'),
    limit: z.coerce.number().int().positive().default(50).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
});

export type GetPendingReviewsQuery = z.infer<typeof GetPendingReviewsQuerySchema>;
