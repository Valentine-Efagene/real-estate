import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Review Party enum
 */
export const ReviewPartyEnum = z.enum([
    'INTERNAL',
    'BANK',
    'DEVELOPER',
    'LEGAL',
    'GOVERNMENT',
    'INSURER',
    'CUSTOMER',
]);

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
        party: ReviewPartyEnum,
        required: z.boolean().default(true),
        organizationId: z.string().optional(),
    })
    .openapi('ReviewRequirement');

/**
 * Submit document review input
 */
export const SubmitDocumentReviewSchema = z
    .object({
        reviewParty: ReviewPartyEnum.describe('The party submitting the review'),
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
        reviewParty: ReviewPartyEnum.describe('The party whose review is being waived'),
        organizationId: z.string().nullable().optional().describe('Organization ID if applicable'),
        reason: z.string().min(10).describe('Reason for waiving the review (min 10 chars)'),
    })
    .openapi('WaiveReviewInput');

export type WaiveReviewInput = z.infer<typeof WaiveReviewSchema>;

/**
 * Get pending reviews query params
 */
export const GetPendingReviewsQuerySchema = z.object({
    reviewParty: ReviewPartyEnum.describe('Filter by review party'),
    organizationId: z.string().optional().describe('Filter by organization'),
    applicationId: z.string().optional().describe('Filter by application'),
    limit: z.coerce.number().int().positive().default(50).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
});

export type GetPendingReviewsQuery = z.infer<typeof GetPendingReviewsQuerySchema>;
