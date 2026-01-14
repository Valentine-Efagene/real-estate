import { Router, Request, Response } from "express";
import { z } from "zod";
import {
    getAuthContext,
    requireTenant,
    requireRole,
    ADMIN_ROLES,
    BlockerActor,
    BlockerCategory,
    BlockerUrgency,
} from "@valentine-efagene/qshelter-common";
import { createWorkflowBlockerService } from "../services/workflow-blocker.service";

const router: Router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const listBlockersSchema = z.object({
    applicationId: z.string().optional(),
    phaseId: z.string().optional(),
    stepId: z.string().optional(),
    blockerActor: z.nativeEnum(BlockerActor).optional(),
    blockerCategory: z.nativeEnum(BlockerCategory).optional(),
    urgency: z.nativeEnum(BlockerUrgency).optional(),
    isOverdue: z.string().transform(val => val === 'true').optional(),
    isResolved: z.string().transform(val => val === 'true').optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const analyticsQuerySchema = z.object({
    periodDays: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const resolveBlockerSchema = z.object({
    resolvedByActor: z.string().min(1),
    resolutionTrigger: z.string().min(1),
});

const recordReminderSchema = z.object({
    nextReminderAt: z.string().datetime().optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getBlockerService(tenantId: string) {
    return createWorkflowBlockerService(tenantId);
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /workflow-blockers/analytics
 * Get blocker analytics for dashboard
 * 
 * Query params:
 * - periodDays: number (default 30) - Number of days to analyze
 */
router.get("/analytics", requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const query = analyticsQuerySchema.parse(req.query);

        const service = getBlockerService(tenantId);
        const analytics = await service.getAnalytics(tenantId, query.periodDays || 30);

        return res.json(analytics);
    } catch (error: any) {
        console.error("Error getting blocker analytics:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to get analytics" });
    }
});

/**
 * GET /workflow-blockers/needing-reminders
 * Get blockers that need reminder notifications
 */
router.get("/needing-reminders", requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);

        const service = getBlockerService(tenantId);
        const blockers = await service.getBlockersNeedingReminders();

        return res.json({ blockers, count: blockers.length });
    } catch (error: any) {
        console.error("Error getting blockers needing reminders:", error);
        return res.status(500).json({ error: error.message || "Failed to get blockers" });
    }
});

/**
 * POST /workflow-blockers/update-overdue
 * Batch update blockers that have become overdue
 */
router.post("/update-overdue", requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);

        const service = getBlockerService(tenantId);
        const count = await service.updateOverdueBlockers();

        return res.json({ message: `Updated ${count} overdue blockers`, count });
    } catch (error: any) {
        console.error("Error updating overdue blockers:", error);
        return res.status(500).json({ error: error.message || "Failed to update overdue blockers" });
    }
});

/**
 * GET /workflow-blockers/application/:applicationId
 * Get all blockers for a specific application
 */
router.get("/application/:applicationId", requireTenant, async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const applicationId = req.params.applicationId as string;

        const service = getBlockerService(tenantId);
        const blockers = await service.getBlockerHistory(applicationId);
        const openBlockers = blockers.filter(b => !b.resolvedAt);
        const resolvedBlockers = blockers.filter(b => b.resolvedAt);

        return res.json({
            blockers,
            summary: {
                total: blockers.length,
                open: openBlockers.length,
                resolved: resolvedBlockers.length,
            }
        });
    } catch (error: any) {
        console.error("Error getting application blockers:", error);
        return res.status(500).json({ error: error.message || "Failed to get blockers" });
    }
});

/**
 * GET /workflow-blockers/application/:applicationId/open
 * Get only open (unresolved) blockers for an application
 */
router.get("/application/:applicationId/open", requireTenant, async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const applicationId = req.params.applicationId as string;

        const service = getBlockerService(tenantId);
        const blockers = await service.getOpenBlockers(applicationId);

        return res.json({ blockers, count: blockers.length });
    } catch (error: any) {
        console.error("Error getting open blockers:", error);
        return res.status(500).json({ error: error.message || "Failed to get blockers" });
    }
});

/**
 * POST /workflow-blockers/:id/resolve
 * Resolve a specific blocker
 */
router.post("/:id/resolve", requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const id = req.params.id as string;
        const body = resolveBlockerSchema.parse(req.body);

        const service = getBlockerService(tenantId);

        // Get the blocker first to resolve by step/phase
        const prisma = require('../lib/prisma').prisma;
        const blocker = await prisma.workflowBlocker.findUnique({
            where: { id },
        });

        if (!blocker) {
            return res.status(404).json({ error: "Blocker not found" });
        }

        if (blocker.resolvedAt) {
            return res.status(400).json({ error: "Blocker already resolved" });
        }

        // Resolve using the appropriate method
        let count = 0;
        if (blocker.stepId) {
            count = await service.resolveStepBlockers(blocker.applicationId, blocker.stepId, body);
        } else if (blocker.phaseId) {
            count = await service.resolvePhaseBlockers(blocker.applicationId, blocker.phaseId, body);
        } else {
            count = await service.resolveApplicationBlockers(blocker.applicationId, body);
        }

        return res.json({ message: `Resolved ${count} blocker(s)`, count });
    } catch (error: any) {
        console.error("Error resolving blocker:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request body", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to resolve blocker" });
    }
});

/**
 * POST /workflow-blockers/:id/reminder-sent
 * Record that a reminder was sent for a blocker
 */
router.post("/:id/reminder-sent", requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const id = req.params.id as string;
        const body = recordReminderSchema.parse(req.body);

        const service = getBlockerService(tenantId);
        await service.recordReminderSent(
            id,
            body.nextReminderAt ? new Date(body.nextReminderAt) : undefined
        );

        return res.json({ message: "Reminder recorded successfully" });
    } catch (error: any) {
        console.error("Error recording reminder:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request body", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to record reminder" });
    }
});

/**
 * POST /workflow-blockers/step/:stepId/resolve
 * Resolve all blockers for a step
 */
router.post("/step/:stepId/resolve", requireTenant, async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const stepId = req.params.stepId as string;
        const body = resolveBlockerSchema.parse(req.body);

        // Get applicationId from step
        const prisma = require('../lib/prisma').prisma;
        const step = await prisma.documentationStep.findUnique({
            where: { id: stepId },
            include: {
                documentationPhase: {
                    include: {
                        phase: true
                    }
                }
            }
        });

        if (!step) {
            return res.status(404).json({ error: "Step not found" });
        }

        const applicationId = step.documentationPhase.phase.applicationId;
        const service = getBlockerService(tenantId);
        const count = await service.resolveStepBlockers(applicationId, stepId, body);

        return res.json({ message: `Resolved ${count} blocker(s) for step`, count });
    } catch (error: any) {
        console.error("Error resolving step blockers:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request body", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to resolve blockers" });
    }
});

/**
 * POST /workflow-blockers/phase/:phaseId/resolve
 * Resolve all blockers for a phase
 */
router.post("/phase/:phaseId/resolve", requireTenant, async (req: Request, res: Response) => {
    try {
        const { tenantId } = getAuthContext(req);
        const phaseId = req.params.phaseId as string;
        const body = resolveBlockerSchema.parse(req.body);

        // Get applicationId from phase
        const prisma = require('../lib/prisma').prisma;
        const phase = await prisma.applicationPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            return res.status(404).json({ error: "Phase not found" });
        }

        const service = getBlockerService(tenantId);
        const count = await service.resolvePhaseBlockers(phase.applicationId, phaseId, body);

        return res.json({ message: `Resolved ${count} blocker(s) for phase`, count });
    } catch (error: any) {
        console.error("Error resolving phase blockers:", error);
        if (error.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request body", details: error.errors });
        }
        return res.status(500).json({ error: error.message || "Failed to resolve blockers" });
    }
});

export default router;
