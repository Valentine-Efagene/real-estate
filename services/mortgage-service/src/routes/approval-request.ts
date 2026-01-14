import { Router, Request, Response } from "express";
import { z } from "zod";
import {
    ApprovalRequestType,
    ApprovalRequestStatus,
    ApprovalRequestPriority,
    ApprovalDecision,
    getAuthContext,
} from "@valentine-efagene/qshelter-common";
import { approvalRequestService } from "../services/approval-request.service";

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createApprovalRequestSchema = z.object({
    type: z.nativeEnum(ApprovalRequestType),
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    payload: z.any().optional(),
    priority: z.nativeEnum(ApprovalRequestPriority).optional(),
    expiresAt: z.string().datetime().optional(),
});

const updateApprovalRequestSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    priority: z.nativeEnum(ApprovalRequestPriority).optional(),
    assigneeId: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
});

const assignApprovalRequestSchema = z.object({
    assigneeId: z.string().min(1),
});

const reviewApprovalRequestSchema = z.object({
    decision: z.nativeEnum(ApprovalDecision),
    reviewNotes: z.string().optional(),
});

const listApprovalRequestsSchema = z.object({
    type: z.nativeEnum(ApprovalRequestType).optional(),
    status: z.nativeEnum(ApprovalRequestStatus).optional(),
    priority: z.nativeEnum(ApprovalRequestPriority).optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    requestedById: z.string().optional(),
    assigneeId: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /approval-requests
 * Create a new approval request
 * 
 * Body:
 * {
 *   "type": "PROPERTY_TRANSFER",
 *   "entityType": "PropertyTransferRequest",
 *   "entityId": "clx...",
 *   "title": "Transfer Request for Unit 2B",
 *   "description": "User wants to transfer from unit 1A to 2B",
 *   "priority": "NORMAL",
 *   "payload": { "reason": "..." }
 * }
 */
router.post("/", async (req: Request, res: Response) => {
    try {
        const { tenantId, userId } = getAuthContext(req);

        const body = createApprovalRequestSchema.parse(req.body);

        const approvalRequest = await approvalRequestService.create(tenantId, {
            ...body,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
            requestedById: userId,
        });

        return res.status(201).json(approvalRequest);
    } catch (error: any) {
        console.error("Error creating approval request:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to create approval request" });
    }
});

/**
 * GET /approval-requests
 * List approval requests with filters
 * 
 * Query params:
 * - type: ApprovalRequestType
 * - status: ApprovalRequestStatus
 * - priority: ApprovalRequestPriority
 * - entityType: string
 * - entityId: string
 * - requestedById: string
 * - assigneeId: string
 * - page: number (default 1)
 * - limit: number (default 20)
 */
router.get("/", async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);

        const query = listApprovalRequestsSchema.parse(req.query);

        const result = await approvalRequestService.list(tenantId, query);

        return res.json(result);
    } catch (error: any) {
        console.error("Error listing approval requests:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to list approval requests" });
    }
});

/**
 * GET /approval-requests/stats
 * Get dashboard statistics
 */
router.get("/stats", async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);

        const stats = await approvalRequestService.getStats(tenantId);

        return res.json(stats);
    } catch (error: any) {
        console.error("Error getting approval request stats:", error);
        return res.status(500).json({ error: error.message || "Failed to get stats" });
    }
});

/**
 * GET /approval-requests/:id
 * Get a specific approval request by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const id = req.params.id as string;

        const approvalRequest = await approvalRequestService.getById(tenantId, id);

        if (!approvalRequest) {
            return res.status(404).json({ error: "Approval request not found" });
        }

        return res.json(approvalRequest);
    } catch (error: any) {
        console.error("Error getting approval request:", error);
        return res.status(500).json({ error: error.message || "Failed to get approval request" });
    }
});

/**
 * PATCH /approval-requests/:id
 * Update an approval request (title, description, priority, assignee)
 */
router.patch("/:id", async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const id = req.params.id as string;

        const body = updateApprovalRequestSchema.parse(req.body);

        const updated = await approvalRequestService.update(tenantId, id, {
            ...body,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        });

        return res.json(updated);
    } catch (error: any) {
        console.error("Error updating approval request:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to update approval request" });
    }
});

/**
 * POST /approval-requests/:id/assign
 * Assign an approval request to a reviewer
 * 
 * Body:
 * {
 *   "assigneeId": "clx..."
 * }
 */
router.post("/:id/assign", async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const id = req.params.id as string;

        const body = assignApprovalRequestSchema.parse(req.body);

        const updated = await approvalRequestService.assign(tenantId, id, body);

        return res.json(updated);
    } catch (error: any) {
        console.error("Error assigning approval request:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to assign approval request" });
    }
});

/**
 * POST /approval-requests/:id/review
 * Review an approval request (approve/reject/request changes)
 * 
 * Body:
 * {
 *   "decision": "APPROVED" | "REJECTED" | "REQUEST_CHANGES",
 *   "reviewNotes": "optional notes"
 * }
 */
router.post("/:id/review", async (req: Request, res: Response) => {
    try {
        const { tenantId, userId } = getAuthContext(req);
        const id = req.params.id as string;

        const body = reviewApprovalRequestSchema.parse(req.body);

        const updated = await approvalRequestService.review(tenantId, id, {
            ...body,
            reviewedById: userId,
        });

        return res.json(updated);
    } catch (error: any) {
        console.error("Error reviewing approval request:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to review approval request" });
    }
});

/**
 * DELETE /approval-requests/:id
 * Cancel an approval request
 */
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const id = req.params.id as string;

        const updated = await approvalRequestService.cancel(tenantId, id);

        return res.json(updated);
    } catch (error: any) {
        console.error("Error cancelling approval request:", error);
        return res.status(500).json({ error: error.message || "Failed to cancel approval request" });
    }
});

export default router;
