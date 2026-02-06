import {
    PrismaClient,
    ReviewDecision,
    DocumentStatus,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Review requirement configuration
 * Uses organization type (e.g., 'PLATFORM', 'BANK', 'DEVELOPER') instead of enum
 * organizationId is optional - if null, any org of that type can review
 */
export interface ReviewRequirement {
    /** The organization type code (e.g., 'PLATFORM', 'BANK', 'DEVELOPER') */
    organizationTypeCode: string;
    /** Whether this review is required */
    required: boolean;
    /** Specific organization ID (optional - if null, any org of that type can review) */
    organizationId?: string;
}

/**
 * Input for submitting a document review
 * Customer reviews have organizationId = null and use 'CUSTOMER' as organizationTypeCode
 */
export interface SubmitReviewInput {
    documentId: string;
    /** The organization type code (looked up and stored as organizationTypeId) */
    organizationTypeCode: string;
    decision: ReviewDecision;
    comments?: string;
    concerns?: Array<{ field: string; issue: string }>;
    /** The reviewing organization (null for customer self-reviews) */
    organizationId?: string;
}

/**
 * Input for creating review records when a document is uploaded
 */
export interface CreateReviewsInput {
    documentId: string;
    tenantId: string;
    reviewRequirements: ReviewRequirement[];
    reviewOrder?: 'SEQUENTIAL' | 'PARALLEL';
}

/**
 * Document Review Service
 * Manages multi-party review workflows for documents
 * 
 * Key concepts:
 * - organizationTypeId: The type of organization doing the review (e.g., PLATFORM, BANK)
 * - organizationId: The specific organization (null for customer self-reviews)
 * - Customer reviews: organizationId = null, organizationTypeCode = 'CUSTOMER'
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createDocumentReviewService(prismaClient: PrismaClient) {
    /**
     * Helper to resolve organization type code to ID
     */
    async function resolveOrganizationTypeId(tenantId: string, code: string): Promise<string> {
        const orgType = await prismaClient.organizationType.findUnique({
            where: { tenantId_code: { tenantId, code } },
        });
        if (!orgType) {
            throw new Error(`Organization type '${code}' not found for tenant`);
        }
        return orgType.id;
    }

    return {
        /**
         * Create review records for a newly uploaded document
         * Called when a document is uploaded for a step with reviewRequirements
         */
        async createReviewsForDocument(input: CreateReviewsInput): Promise<void> {
            const { documentId, tenantId, reviewRequirements, reviewOrder = 'SEQUENTIAL' } = input;

            // Resolve all organization type codes to IDs
            const reviews = await Promise.all(
                reviewRequirements.map(async (req, index) => {
                    const organizationTypeId = await resolveOrganizationTypeId(tenantId, req.organizationTypeCode);
                    return {
                        id: uuidv4(),
                        tenantId,
                        documentId,
                        organizationTypeId,
                        organizationId: req.organizationId || null,
                        decision: 'PENDING' as ReviewDecision,
                        // For sequential reviews, set order based on array position
                        reviewOrder: reviewOrder === 'SEQUENTIAL' ? index + 1 : 0,
                    };
                })
            );

            await prismaClient.documentReview.createMany({
                data: reviews,
            });
        },

        /**
         * Get all reviews for a document
         */
        async getReviewsForDocument(documentId: string) {
            return prismaClient.documentReview.findMany({
                where: { documentId },
                include: {
                    reviewer: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    organizationType: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                    childReviews: true,
                },
                orderBy: { reviewOrder: 'asc' },
            });
        },

        /**
         * Get pending reviews for a specific organization type
         */
        async getPendingReviewsForParty(
            tenantId: string,
            organizationTypeCode: string,
            organizationId?: string
        ) {
            const organizationTypeId = await resolveOrganizationTypeId(tenantId, organizationTypeCode);

            return prismaClient.documentReview.findMany({
                where: {
                    tenantId,
                    organizationTypeId,
                    organizationId: organizationId || null,
                    decision: 'PENDING',
                },
                include: {
                    document: {
                        include: {
                            application: {
                                select: {
                                    id: true,
                                    title: true,
                                },
                            },
                        },
                    },
                    organizationType: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                },
                orderBy: { requestedAt: 'asc' },
            });
        },

        /**
         * Check if an organization type can review (for sequential review order)
         */
        async canPartyReview(
            documentId: string,
            tenantId: string,
            organizationTypeCode: string,
            organizationId?: string
        ): Promise<{ canReview: boolean; reason?: string }> {
            const organizationTypeId = await resolveOrganizationTypeId(tenantId, organizationTypeCode);

            const reviews = await prismaClient.documentReview.findMany({
                where: { documentId },
                include: {
                    organizationType: {
                        select: { code: true, name: true },
                    },
                },
                orderBy: { reviewOrder: 'asc' },
            });

            const targetReview = reviews.find(
                (r) => r.organizationTypeId === organizationTypeId && r.organizationId === (organizationId || null)
            );

            if (!targetReview) {
                return { canReview: false, reason: 'No review required for this party' };
            }

            if (targetReview.decision !== 'PENDING') {
                return { canReview: false, reason: 'Review already submitted' };
            }

            // Check if this is sequential and previous reviews are pending
            if (targetReview.reviewOrder > 0) {
                const previousPending = reviews.find(
                    (r) => r.reviewOrder > 0 && r.reviewOrder < targetReview.reviewOrder && r.decision === 'PENDING'
                );

                if (previousPending) {
                    const waitingFor = previousPending.organizationType?.name || previousPending.organizationType?.code || 'previous party';
                    return {
                        canReview: false,
                        reason: `Waiting for ${waitingFor} review`,
                    };
                }
            }

            return { canReview: true };
        },

        /**
         * Submit a review for a document
         */
        async submitReview(
            input: SubmitReviewInput,
            reviewerId: string,
            tenantId: string
        ): Promise<{ success: boolean; review?: any; error?: string }> {
            const { documentId, organizationTypeCode, decision, comments, concerns, organizationId } = input;

            // Check if party can review
            const canReviewResult = await this.canPartyReview(documentId, tenantId, organizationTypeCode, organizationId);
            if (!canReviewResult.canReview) {
                return { success: false, error: canReviewResult.reason };
            }

            // Resolve organization type
            const organizationTypeId = await resolveOrganizationTypeId(tenantId, organizationTypeCode);

            // Get reviewer info
            const reviewer = await prismaClient.user.findUnique({
                where: { id: reviewerId },
                select: { firstName: true, lastName: true, email: true },
            });

            // Update the review using composite key
            const review = await prismaClient.documentReview.update({
                where: {
                    documentId_organizationId: {
                        documentId,
                        organizationId: organizationId || '',
                    },
                },
                data: {
                    decision,
                    comments,
                    concerns: concerns ? JSON.stringify(concerns) : undefined,
                    reviewerId,
                    reviewerName: reviewer ? `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() || reviewer.email : undefined,
                    reviewedAt: new Date(),
                },
                include: {
                    document: true,
                },
            });

            // If changes requested, update document status
            if (decision === 'CHANGES_REQUESTED') {
                await prismaClient.applicationDocument.update({
                    where: { id: documentId },
                    data: { status: 'PENDING' }, // Reset to pending for re-upload
                });
            }

            // Check if all required reviews are approved
            await this.checkAndUpdateDocumentStatus(documentId);

            return { success: true, review };
        },

        /**
         * Check if all required reviews are approved and update document status
         * Also completes the step and evaluates phase completion when all parties approve
         */
        async checkAndUpdateDocumentStatus(documentId: string): Promise<DocumentStatus> {
            const document = await prismaClient.applicationDocument.findUnique({
                where: { id: documentId },
                include: { reviews: true },
            });

            if (!document) {
                return 'PENDING';
            }

            const reviews = document.reviews;

            // Check if any review is rejected
            const hasRejection = reviews.some((r) => r.decision === 'REJECTED');
            if (hasRejection) {
                await prismaClient.applicationDocument.update({
                    where: { id: documentId },
                    data: { status: 'REJECTED' },
                });

                // Note: Step-based logic removed - now using stage-based approval workflow

                return 'REJECTED';
            }

            // Check if any review has changes requested
            const hasChangesRequested = reviews.some((r) => r.decision === 'CHANGES_REQUESTED');
            if (hasChangesRequested) {
                // Document stays PENDING, waiting for re-upload
                // Note: Step-based logic removed - now using stage-based approval workflow
                return 'PENDING';
            }

            // Check if all required reviews are approved or waived
            const allApproved = reviews.every(
                (r) => r.decision === 'APPROVED' || r.decision === 'WAIVED'
            );

            if (allApproved) {
                await prismaClient.applicationDocument.update({
                    where: { id: documentId },
                    data: { status: 'APPROVED' },
                });

                // Note: Step-based completion logic removed - now handled by ApprovalWorkflowService
                console.log(`[DocumentReview] Document ${documentId} approved - all parties approved`);

                return 'APPROVED';
            }

            // Still pending reviews
            return 'PENDING';
        },

        /**
         * Create new review records for a re-uploaded document
         * Links to parent reviews for audit trail
         */
        async createReviewsForReupload(
            newDocumentId: string,
            originalDocumentId: string,
            tenantId: string
        ): Promise<void> {
            // Get original reviews
            const originalReviews = await prismaClient.documentReview.findMany({
                where: { documentId: originalDocumentId },
            });

            // Create new reviews linked to original
            const newReviews = originalReviews.map((orig) => ({
                id: uuidv4(),
                tenantId,
                documentId: newDocumentId,
                organizationTypeId: orig.organizationTypeId,
                organizationId: orig.organizationId,
                decision: 'PENDING' as ReviewDecision,
                reviewOrder: orig.reviewOrder,
                parentReviewId: orig.id,
            }));

            await prismaClient.documentReview.createMany({
                data: newReviews,
            });
        },

        /**
         * Get review summary for a document (for UI display)
         */
        async getReviewSummary(documentId: string) {
            const reviews = await prismaClient.documentReview.findMany({
                where: { documentId },
                include: {
                    reviewer: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    organizationType: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { reviewOrder: 'asc' },
            });

            const summary = {
                totalReviews: reviews.length,
                approvedCount: reviews.filter((r) => r.decision === 'APPROVED').length,
                pendingCount: reviews.filter((r) => r.decision === 'PENDING').length,
                rejectedCount: reviews.filter((r) => r.decision === 'REJECTED').length,
                changesRequestedCount: reviews.filter((r) => r.decision === 'CHANGES_REQUESTED').length,
                waivedCount: reviews.filter((r) => r.decision === 'WAIVED').length,
                allApproved: reviews.every((r) => r.decision === 'APPROVED' || r.decision === 'WAIVED'),
                hasIssues: reviews.some((r) => r.decision === 'REJECTED' || r.decision === 'CHANGES_REQUESTED'),
                reviews: reviews.map((r) => ({
                    id: r.id,
                    organizationType: r.organizationType,
                    organizationId: r.organizationId,
                    organization: r.organization,
                    decision: r.decision,
                    comments: r.comments,
                    concerns: r.concerns,
                    reviewer: r.reviewer,
                    reviewerName: r.reviewerName,
                    reviewedAt: r.reviewedAt,
                    requestedAt: r.requestedAt,
                })),
            };

            return summary;
        },

        /**
         * Get all documents pending review for an organization type (dashboard view)
         */
        async getDocumentsPendingReview(
            tenantId: string,
            organizationTypeCode: string,
            options?: {
                organizationId?: string;
                applicationId?: string;
                limit?: number;
                offset?: number;
            }
        ) {
            const organizationTypeId = await resolveOrganizationTypeId(tenantId, organizationTypeCode);
            const { organizationId, applicationId, limit = 50, offset = 0 } = options || {};

            const where: any = {
                tenantId,
                organizationTypeId,
                decision: 'PENDING',
            };

            if (organizationId) {
                where.organizationId = organizationId;
            }

            if (applicationId) {
                where.document = { applicationId };
            }

            const [reviews, total] = await Promise.all([
                prismaClient.documentReview.findMany({
                    where,
                    include: {
                        document: {
                            include: {
                                application: {
                                    select: {
                                        id: true,
                                        title: true,
                                        buyer: {
                                            select: {
                                                id: true,
                                                firstName: true,
                                                lastName: true,
                                                email: true,
                                            },
                                        },
                                    },
                                },
                                uploadedBy: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { requestedAt: 'asc' },
                    take: limit,
                    skip: offset,
                }),
                prismaClient.documentReview.count({ where }),
            ]);

            return {
                reviews,
                total,
                limit,
                offset,
            };
        },

        /**
         * Waive a review requirement (admin action)
         */
        async waiveReview(
            documentId: string,
            tenantId: string,
            organizationTypeCode: string,
            organizationId: string | null,
            waiverId: string,
            reason: string
        ) {
            const organizationTypeId = await resolveOrganizationTypeId(tenantId, organizationTypeCode);

            const waiver = await prismaClient.user.findUnique({
                where: { id: waiverId },
                select: { firstName: true, lastName: true, email: true },
            });

            const review = await prismaClient.documentReview.update({
                where: {
                    documentId_organizationId: {
                        documentId,
                        organizationId: organizationId || '',
                    },
                },
                data: {
                    decision: 'WAIVED',
                    comments: `Waived: ${reason}`,
                    reviewerId: waiverId,
                    reviewerName: waiver ? `${waiver.firstName || ''} ${waiver.lastName || ''}`.trim() || waiver.email : undefined,
                    reviewedAt: new Date(),
                },
            });

            // Check and update document status
            await this.checkAndUpdateDocumentStatus(documentId);

            return review;
        },
    };
}

export type DocumentReviewService = ReturnType<typeof createDocumentReviewService>;
