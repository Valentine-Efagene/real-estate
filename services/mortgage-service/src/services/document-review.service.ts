import {
    PrismaClient,
    ReviewParty,
    ReviewDecision,
    DocumentStatus,
} from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Review requirement configuration
 */
export interface ReviewRequirement {
    party: ReviewParty;
    required: boolean;
    organizationId?: string;
}

/**
 * Input for submitting a document review
 */
export interface SubmitReviewInput {
    documentId: string;
    reviewParty: ReviewParty;
    decision: ReviewDecision;
    comments?: string;
    concerns?: Array<{ field: string; issue: string }>;
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
 */
export function createDocumentReviewService(prismaClient: PrismaClient) {
    return {
        /**
         * Create review records for a newly uploaded document
         * Called when a document is uploaded for a step with reviewRequirements
         */
        async createReviewsForDocument(input: CreateReviewsInput): Promise<void> {
            const { documentId, tenantId, reviewRequirements, reviewOrder = 'SEQUENTIAL' } = input;

            // Create a review record for each required party
            const reviews = reviewRequirements.map((req, index) => ({
                id: uuidv4(),
                tenantId,
                documentId,
                reviewParty: req.party,
                organizationId: req.organizationId || null,
                decision: 'PENDING' as ReviewDecision,
                // For sequential reviews, set order based on array position
                reviewOrder: reviewOrder === 'SEQUENTIAL' ? index + 1 : 0,
            }));

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
                    childReviews: true,
                },
                orderBy: { reviewOrder: 'asc' },
            });
        },

        /**
         * Get pending reviews for a specific party
         */
        async getPendingReviewsForParty(
            tenantId: string,
            reviewParty: ReviewParty,
            organizationId?: string
        ) {
            return prismaClient.documentReview.findMany({
                where: {
                    tenantId,
                    reviewParty,
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
                },
                orderBy: { requestedAt: 'asc' },
            });
        },

        /**
         * Check if a party can review (for sequential review order)
         */
        async canPartyReview(
            documentId: string,
            reviewParty: ReviewParty,
            organizationId?: string
        ): Promise<{ canReview: boolean; reason?: string }> {
            const reviews = await prismaClient.documentReview.findMany({
                where: { documentId },
                orderBy: { reviewOrder: 'asc' },
            });

            const targetReview = reviews.find(
                (r) => r.reviewParty === reviewParty && r.organizationId === (organizationId || null)
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
                    return {
                        canReview: false,
                        reason: `Waiting for ${previousPending.reviewParty} review`,
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
            reviewerId: string
        ): Promise<{ success: boolean; review?: any; error?: string }> {
            const { documentId, reviewParty, decision, comments, concerns, organizationId } = input;

            // Check if party can review
            const canReviewResult = await this.canPartyReview(documentId, reviewParty, organizationId);
            if (!canReviewResult.canReview) {
                return { success: false, error: canReviewResult.reason };
            }

            // Get reviewer info
            const reviewer = await prismaClient.user.findUnique({
                where: { id: reviewerId },
                select: { firstName: true, lastName: true, email: true },
            });

            // Update the review
            const review = await prismaClient.documentReview.update({
                where: {
                    documentId_reviewParty_organizationId: {
                        documentId,
                        reviewParty,
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
                reviewParty: orig.reviewParty,
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
                    party: r.reviewParty,
                    organizationId: r.organizationId,
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
         * Get all documents pending review for a party (dashboard view)
         */
        async getDocumentsPendingReview(
            tenantId: string,
            reviewParty: ReviewParty,
            options?: {
                organizationId?: string;
                applicationId?: string;
                limit?: number;
                offset?: number;
            }
        ) {
            const { organizationId, applicationId, limit = 50, offset = 0 } = options || {};

            const where: any = {
                tenantId,
                reviewParty,
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
            reviewParty: ReviewParty,
            organizationId: string | null,
            waiverId: string,
            reason: string
        ) {
            const waiver = await prismaClient.user.findUnique({
                where: { id: waiverId },
                select: { firstName: true, lastName: true, email: true },
            });

            const review = await prismaClient.documentReview.update({
                where: {
                    documentId_reviewParty_organizationId: {
                        documentId,
                        reviewParty,
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
