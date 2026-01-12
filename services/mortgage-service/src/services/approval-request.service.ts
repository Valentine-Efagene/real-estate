import {
    ApprovalRequestType,
    ApprovalRequestStatus,
    ApprovalRequestPriority,
    ApprovalDecision,
    Prisma,
} from "@valentine-efagene/qshelter-common";
import { prisma } from "../lib/prisma";

// Type alias for the ApprovalRequest model from Prisma
type ApprovalRequest = any;

// Import domain services for dispatch (avoid circular deps by lazy loading)
let propertyTransferService: any;
const getPropertyTransferService = async () => {
    if (!propertyTransferService) {
        propertyTransferService = (await import('./property-transfer.service')).propertyTransferService;
    }
    return propertyTransferService;
};

interface CreateApprovalRequestDto {
    type: ApprovalRequestType;
    entityType: string;
    entityId: string;
    title: string;
    description?: string;
    payload?: Prisma.InputJsonValue;
    priority?: ApprovalRequestPriority;
    requestedById: string;
    expiresAt?: Date;
}

interface UpdateApprovalRequestDto {
    title?: string;
    description?: string;
    priority?: ApprovalRequestPriority;
    assigneeId?: string;
    expiresAt?: Date;
}

interface AssignApprovalRequestDto {
    assigneeId: string;
}

interface ReviewApprovalRequestDto {
    decision: ApprovalDecision;
    reviewNotes?: string;
    reviewedById: string;
}

interface ListApprovalRequestsOptions {
    type?: ApprovalRequestType;
    status?: ApprovalRequestStatus;
    priority?: ApprovalRequestPriority;
    entityType?: string;
    entityId?: string;
    requestedById?: string;
    assigneeId?: string;
    page?: number;
    limit?: number;
}

export class ApprovalRequestService {
    async create(
        tenantId: string,
        dto: CreateApprovalRequestDto
    ): Promise<ApprovalRequest> {
        const db = prisma;

        // Verify requestor exists
        const requestor = await db.user.findUnique({
            where: { id: dto.requestedById },
        });

        if (!requestor) {
            throw new Error(`Requestor not found: ${dto.requestedById}`);
        }

        // Create the approval request
        const approvalRequest = await db.approvalRequest.create({
            data: {
                tenantId,
                type: dto.type,
                entityType: dto.entityType,
                entityId: dto.entityId,
                title: dto.title,
                description: dto.description,
                payload: dto.payload as Prisma.InputJsonValue | undefined,
                priority: dto.priority ?? ApprovalRequestPriority.NORMAL,
                requestedById: dto.requestedById,
                expiresAt: dto.expiresAt,
                status: ApprovalRequestStatus.PENDING,
            },
            include: {
                requestedBy: true,
                assignee: true,
                reviewedBy: true,
            },
        });

        // TODO: Emit domain event
        // await emitDomainEvent('approval_request.created', ...)

        return approvalRequest;
    }

    async getById(
        tenantId: string,
        id: string
    ): Promise<ApprovalRequest | null> {
        const db = prisma;

        return db.approvalRequest.findFirst({
            where: { id, tenantId },
            include: {
                requestedBy: true,
                assignee: true,
                reviewedBy: true,
            },
        });
    }

    async list(
        tenantId: string,
        options: ListApprovalRequestsOptions = {}
    ): Promise<{
        data: ApprovalRequest[];
        total: number;
        page: number;
        limit: number;
    }> {
        const db = prisma;

        const {
            type,
            status,
            priority,
            entityType,
            entityId,
            requestedById,
            assigneeId,
            page = 1,
            limit = 20,
        } = options;

        const where: Prisma.ApprovalRequestWhereInput = { tenantId };

        if (type) where.type = type;
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;
        if (requestedById) where.requestedById = requestedById;
        if (assigneeId) where.assigneeId = assigneeId;

        const [data, total] = await Promise.all([
            db.approvalRequest.findMany({
                where,
                include: {
                    requestedBy: true,
                    assignee: true,
                    reviewedBy: true,
                },
                orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            db.approvalRequest.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    async update(
        tenantId: string,
        id: string,
        dto: UpdateApprovalRequestDto
    ): Promise<ApprovalRequest> {
        const db = prisma;

        // Check if exists
        const existing = await db.approvalRequest.findFirst({
            where: { id, tenantId },
        });

        if (!existing) {
            throw new Error(`ApprovalRequest not found: ${id}`);
        }

        // Only allow updates if still pending
        if (
            existing.status !== ApprovalRequestStatus.PENDING &&
            existing.status !== ApprovalRequestStatus.IN_REVIEW
        ) {
            throw new Error(
                `Cannot update approval request in status: ${existing.status}`
            );
        }

        // Verify assignee exists if provided
        if (dto.assigneeId) {
            const assignee = await db.user.findUnique({
                where: { id: dto.assigneeId },
            });

            if (!assignee) {
                throw new Error(`Assignee not found: ${dto.assigneeId}`);
            }
        }

        const updated = await db.approvalRequest.update({
            where: { id },
            data: {
                title: dto.title,
                description: dto.description,
                priority: dto.priority,
                assigneeId: dto.assigneeId,
                expiresAt: dto.expiresAt,
            },
            include: {
                requestedBy: true,
                assignee: true,
                reviewedBy: true,
            },
        });

        return updated;
    }

    async assign(
        tenantId: string,
        id: string,
        dto: AssignApprovalRequestDto
    ): Promise<ApprovalRequest> {
        const db = prisma;

        // Check if exists
        const existing = await db.approvalRequest.findFirst({
            where: { id, tenantId },
        });

        if (!existing) {
            throw new Error(`ApprovalRequest not found: ${id}`);
        }

        // Only allow assignment if pending or in-review
        if (
            existing.status !== ApprovalRequestStatus.PENDING &&
            existing.status !== ApprovalRequestStatus.IN_REVIEW
        ) {
            throw new Error(
                `Cannot assign approval request in status: ${existing.status}`
            );
        }

        // Verify assignee exists
        const assignee = await db.user.findUnique({
            where: { id: dto.assigneeId },
        });

        if (!assignee) {
            throw new Error(`Assignee not found: ${dto.assigneeId}`);
        }

        const updated = await db.approvalRequest.update({
            where: { id },
            data: {
                assigneeId: dto.assigneeId,
                assignedAt: new Date(),
                status: ApprovalRequestStatus.IN_REVIEW,
            },
            include: {
                requestedBy: true,
                assignee: true,
                reviewedBy: true,
            },
        });

        // TODO: Emit domain event
        // await emitDomainEvent('approval_request.assigned', ...)

        return updated;
    }

    async review(
        tenantId: string,
        id: string,
        dto: ReviewApprovalRequestDto
    ): Promise<ApprovalRequest> {
        const db = prisma;

        // Check if exists
        const existing = await db.approvalRequest.findFirst({
            where: { id, tenantId },
        });

        if (!existing) {
            throw new Error(`ApprovalRequest not found: ${id}`);
        }

        // Only allow review if pending or in-review
        if (
            existing.status !== ApprovalRequestStatus.PENDING &&
            existing.status !== ApprovalRequestStatus.IN_REVIEW
        ) {
            throw new Error(
                `Cannot review approval request in status: ${existing.status}`
            );
        }

        // Verify reviewer exists
        const reviewer = await db.user.findUnique({
            where: { id: dto.reviewedById },
        });

        if (!reviewer) {
            throw new Error(`Reviewer not found: ${dto.reviewedById}`);
        }

        // Determine new status based on decision
        let newStatus: ApprovalRequestStatus;
        switch (dto.decision) {
            case ApprovalDecision.APPROVED:
                newStatus = ApprovalRequestStatus.APPROVED;
                break;
            case ApprovalDecision.REJECTED:
                newStatus = ApprovalRequestStatus.REJECTED;
                break;
            case ApprovalDecision.REQUEST_CHANGES:
                newStatus = ApprovalRequestStatus.PENDING;
                break;
            default:
                throw new Error(`Invalid decision: ${dto.decision}`);
        }

        // Execute domain action and update approval request in same transaction
        const updated = await db.$transaction(async (tx) => {
            // Execute domain action based on decision (dispatch by type)
            if (dto.decision === ApprovalDecision.APPROVED) {
                await this.executeApprovalAction(existing, dto.reviewedById, dto.reviewNotes, tx);
            } else if (dto.decision === ApprovalDecision.REJECTED) {
                await this.executeRejectionAction(existing, dto.reviewedById, dto.reviewNotes, tx);
            }

            // Update approval request
            return await tx.approvalRequest.update({
                where: { id },
                data: {
                    decision: dto.decision,
                    reviewNotes: dto.reviewNotes,
                    reviewedById: dto.reviewedById,
                    reviewedAt: new Date(),
                    status: newStatus,
                    completedAt:
                        newStatus === ApprovalRequestStatus.APPROVED ||
                            newStatus === ApprovalRequestStatus.REJECTED
                            ? new Date()
                            : undefined,
                },
                include: {
                    requestedBy: true,
                    assignee: true,
                    reviewedBy: true,
                },
            });
        });

        // TODO: Emit domain event
        // const eventType = dto.decision === ApprovalDecision.APPROVED
        //   ? 'approval_request.approved'
        //   : dto.decision === ApprovalDecision.REJECTED
        //   ? 'approval_request.rejected'
        //   : 'approval_request.changes_requested';
        // await emitDomainEvent(eventType, ...)

        return updated;
    }

    /**
     * Execute the domain action for an approved request
     * Dispatches to the appropriate service based on request type
     */
    private async executeApprovalAction(
        approvalRequest: any,
        reviewerId: string,
        reviewNotes?: string,
        tx?: any
    ): Promise<void> {
        const { type, entityId, tenantId } = approvalRequest;
        const db = tx || prisma;

        switch (type) {
            case ApprovalRequestType.PROPERTY_TRANSFER: {
                const transferService = await getPropertyTransferService();
                await transferService.approve({
                    requestId: entityId, // entityId is the PropertyTransferRequest.id
                    reviewerId,
                    reviewNotes,
                    tenantId,
                });
                break;
            }
            case ApprovalRequestType.REFUND_APPROVAL: {
                // Approve the refund
                await db.applicationRefund.update({
                    where: { id: entityId },
                    data: {
                        status: 'APPROVED',
                        approvedById: reviewerId,
                        approvedAt: new Date(),
                        approvalNotes: reviewNotes,
                    },
                });

                // Create audit event
                const refund = await db.applicationRefund.findUnique({
                    where: { id: entityId },
                    select: { applicationId: true, amount: true },
                });

                if (refund) {
                    await db.applicationEvent.create({
                        data: {
                            applicationId: refund.applicationId,
                            eventType: 'PAYMENT_COMPLETED',
                            eventGroup: 'PAYMENT',
                            data: {
                                refundId: entityId,
                                amount: refund.amount,
                                approvedBy: reviewerId,
                                notes: reviewNotes,
                            },
                            actorId: reviewerId,
                            actorType: 'USER',
                        },
                    });
                }
                break;
            }
            // Add other approval types here as they're implemented:
            // case ApprovalRequestType.PROPERTY_UPDATE:
            //   await propertyUpdateService.approve({ ... });
            //   break;
            // case ApprovalRequestType.application_TERMINATION:
            //   await applicationTerminationService.approve({ ... });
            //   break;
            default:
                // Log or throw for unknown types
                console.warn(`No handler registered for approval type: ${type}`);
        }
    }

    /**
     * Execute the rejection action for a rejected request
     * Dispatches to the appropriate service based on request type
     */
    private async executeRejectionAction(
        approvalRequest: any,
        reviewerId: string,
        reviewNotes?: string,
        tx?: any
    ): Promise<void> {
        const { type, entityId } = approvalRequest;
        const db = tx || prisma;

        switch (type) {
            case ApprovalRequestType.REFUND_APPROVAL: {
                // Reject the refund
                await db.applicationRefund.update({
                    where: { id: entityId },
                    data: {
                        status: 'REJECTED',
                        rejectedAt: new Date(),
                        rejectionNotes: reviewNotes,
                    },
                });
                break;
            }
            // Add other rejection handlers as needed
            default:
                // Most approval types don't need special rejection handling
                // The ApprovalRequest status change is sufficient
                break;
        }
    }

    async cancel(tenantId: string, id: string): Promise<ApprovalRequest> {
        const db = prisma;

        // Check if exists
        const existing = await db.approvalRequest.findFirst({
            where: { id, tenantId },
        });

        if (!existing) {
            throw new Error(`ApprovalRequest not found: ${id}`);
        }

        // Only allow cancellation if pending or in-review
        if (
            existing.status !== ApprovalRequestStatus.PENDING &&
            existing.status !== ApprovalRequestStatus.IN_REVIEW
        ) {
            throw new Error(
                `Cannot cancel approval request in status: ${existing.status}`
            );
        }

        const updated = await db.approvalRequest.update({
            where: { id },
            data: {
                status: ApprovalRequestStatus.CANCELLED,
                completedAt: new Date(),
            },
            include: {
                requestedBy: true,
                assignee: true,
                reviewedBy: true,
            },
        });

        // TODO: Emit domain event
        // await emitDomainEvent('approval_request.cancelled', ...)

        return updated;
    }

    /**
     * Get dashboard stats for admin view
     */
    async getStats(tenantId: string): Promise<{
        pending: number;
        inReview: number;
        approved: number;
        rejected: number;
        byType: Record<string, number>;
        byPriority: Record<string, number>;
    }> {
        const db = prisma;

        const [pending, inReview, approved, rejected, byType, byPriority] =
            await Promise.all([
                db.approvalRequest.count({
                    where: { tenantId, status: ApprovalRequestStatus.PENDING },
                }),
                db.approvalRequest.count({
                    where: { tenantId, status: ApprovalRequestStatus.IN_REVIEW },
                }),
                db.approvalRequest.count({
                    where: { tenantId, status: ApprovalRequestStatus.APPROVED },
                }),
                db.approvalRequest.count({
                    where: { tenantId, status: ApprovalRequestStatus.REJECTED },
                }),
                db.approvalRequest.groupBy({
                    where: { tenantId },
                    by: ["type"],
                    _count: true,
                }),
                db.approvalRequest.groupBy({
                    where: { tenantId },
                    by: ["priority"],
                    _count: true,
                }),
            ]);

        return {
            pending,
            inReview,
            approved,
            rejected,
            byType: Object.fromEntries(
                byType.map((t: any) => [t.type, t._count])
            ),
            byPriority: Object.fromEntries(
                byPriority.map((p: any) => [p.priority, p._count])
            ),
        };
    }
}

export const approvalRequestService = new ApprovalRequestService();
