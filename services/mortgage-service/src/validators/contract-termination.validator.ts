import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// =============================================================================
// ENUMS - Match Prisma schema
// =============================================================================

export const TerminationTypeEnum = z.enum([
    'BUYER_WITHDRAWAL',
    'SELLER_WITHDRAWAL',
    'MUTUAL_AGREEMENT',
    'PAYMENT_DEFAULT',
    'DOCUMENT_FAILURE',
    'FRAUD',
    'FORCE_MAJEURE',
    'PROPERTY_UNAVAILABLE',
    'REGULATORY',
    'OTHER',
]);

export const TerminationStatusEnum = z.enum([
    'REQUESTED',
    'PENDING_REVIEW',
    'PENDING_REFUND',
    'REFUND_IN_PROGRESS',
    'REFUND_COMPLETED',
    'COMPLETED',
    'REJECTED',
    'CANCELLED',
]);

export const RefundStatusEnum = z.enum([
    'NOT_APPLICABLE',
    'PENDING',
    'INITIATED',
    'PROCESSING',
    'PARTIAL_COMPLETED',
    'COMPLETED',
    'FAILED',
]);

export const TerminationInitiatorEnum = z.enum([
    'BUYER',
    'SELLER',
    'ADMIN',
    'SYSTEM',
]);

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

/**
 * Request contract termination (buyer/seller initiated)
 */
export const RequestTerminationSchema = z
    .object({
        type: TerminationTypeEnum.openapi({ example: 'BUYER_WITHDRAWAL' }),
        reason: z.string().min(10).max(2000).optional().openapi({
            example: 'I have found a better property that suits my needs.',
        }),
        supportingDocs: z.array(z.object({
            type: z.string(),
            url: z.string().url(),
            uploadedAt: z.string().datetime().optional(),
        })).optional(),
    })
    .openapi('RequestTermination');

/**
 * Admin-initiated termination (e.g., payment default, fraud)
 */
export const AdminTerminationSchema = z
    .object({
        type: TerminationTypeEnum.openapi({ example: 'PAYMENT_DEFAULT' }),
        reason: z.string().min(10).max(2000).openapi({
            example: 'Buyer has failed to make payments for 3 consecutive months.',
        }),
        bypassApproval: z.boolean().default(false).openapi({
            description: 'Skip approval workflow (for urgent cases)',
        }),
        supportingDocs: z.array(z.object({
            type: z.string(),
            url: z.string().url(),
            uploadedAt: z.string().datetime().optional(),
        })).optional(),
    })
    .openapi('AdminTermination');

/**
 * Review termination request (approve/reject)
 */
export const ReviewTerminationSchema = z
    .object({
        decision: z.enum(['APPROVE', 'REJECT']).openapi({ example: 'APPROVE' }),
        notes: z.string().max(2000).optional().openapi({
            example: 'Approved per policy. Refund calculation attached.',
        }),
        rejectionReason: z.string().min(10).max(2000).optional().openapi({
            example: 'Request does not meet criteria for voluntary withdrawal.',
        }),
        // Settlement override (admin can adjust calculated amounts)
        settlementOverride: z.object({
            refundableAmount: z.number().min(0).optional(),
            penaltyAmount: z.number().min(0).optional(),
            forfeitedAmount: z.number().min(0).optional(),
            adminFeeAmount: z.number().min(0).optional(),
            notes: z.string().optional(),
        }).optional(),
    })
    .refine(
        (data) => {
            if (data.decision === 'REJECT' && !data.rejectionReason) {
                return false;
            }
            return true;
        },
        { message: 'rejectionReason is required when decision is REJECT' }
    )
    .openapi('ReviewTermination');

/**
 * Process refund
 */
export const ProcessRefundSchema = z
    .object({
        refundMethod: z.enum(['ORIGINAL_METHOD', 'BANK_TRANSFER', 'CHECK', 'WALLET']).openapi({
            example: 'BANK_TRANSFER',
        }),
        refundAccountDetails: z.object({
            bankName: z.string().optional(),
            accountNumber: z.string().optional(),
            accountName: z.string().optional(),
            routingNumber: z.string().optional(),
            walletAddress: z.string().optional(),
        }).optional(),
        notes: z.string().optional(),
    })
    .openapi('ProcessRefund');

/**
 * Complete refund (after gateway confirmation)
 */
export const CompleteRefundSchema = z
    .object({
        refundReference: z.string().openapi({ example: 'REF-123456789' }),
        actualRefundAmount: z.number().min(0).optional().openapi({
            description: 'Actual amount refunded (may differ due to gateway fees)',
        }),
        notes: z.string().optional(),
    })
    .openapi('CompleteRefund');

/**
 * Cancel termination request (before approval)
 */
export const CancelTerminationSchema = z
    .object({
        reason: z.string().min(5).max(500).optional().openapi({
            example: 'Buyer has decided to continue with the contract.',
        }),
    })
    .openapi('CancelTermination');

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

export const TerminationResponseSchema = z
    .object({
        id: z.string(),
        contractId: z.string(),
        requestNumber: z.string(),
        initiatedBy: TerminationInitiatorEnum,
        type: TerminationTypeEnum,
        reason: z.string().nullable(),
        status: TerminationStatusEnum,
        requiresApproval: z.boolean(),
        autoApproveEligible: z.boolean(),
        // Financial
        totalContractAmount: z.number(),
        totalPaidToDate: z.number(),
        outstandingBalance: z.number(),
        refundableAmount: z.number(),
        penaltyAmount: z.number(),
        forfeitedAmount: z.number(),
        adminFeeAmount: z.number(),
        netRefundAmount: z.number(),
        // Refund
        refundStatus: RefundStatusEnum,
        refundReference: z.string().nullable(),
        refundMethod: z.string().nullable(),
        // Timing
        requestedAt: z.date(),
        reviewedAt: z.date().nullable(),
        approvedAt: z.date().nullable(),
        executedAt: z.date().nullable(),
        completedAt: z.date().nullable(),
        // Review
        reviewNotes: z.string().nullable(),
        rejectionReason: z.string().nullable(),
    })
    .openapi('TerminationResponse');

// =============================================================================
// TYPES
// =============================================================================

export type RequestTerminationInput = z.infer<typeof RequestTerminationSchema>;
export type AdminTerminationInput = z.infer<typeof AdminTerminationSchema>;
export type ReviewTerminationInput = z.infer<typeof ReviewTerminationSchema>;
export type ProcessRefundInput = z.infer<typeof ProcessRefundSchema>;
export type CompleteRefundInput = z.infer<typeof CompleteRefundSchema>;
export type CancelTerminationInput = z.infer<typeof CancelTerminationSchema>;
