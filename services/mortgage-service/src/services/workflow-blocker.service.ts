import {
    BlockerActor,
    BlockerCategory,
    BlockerUrgency,
    WorkflowBlockerModel,
    Prisma,
    PrismaClient,
    NextActor,
    ActionCategory,
    createTenantPrisma,
} from "@valentine-efagene/qshelter-common";
import { prisma as defaultPrisma } from "../lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrismaClient = any;

/**
 * Workflow Blocker Service
 *
 * Tracks who is blocking the workflow at any point, enabling analytics like:
 * - Average time customers take to upload documents
 * - Average time admins take to review/approve
 * - Most common bottleneck steps
 * - SLA compliance tracking
 * - Customer service intervention triggers
 */

// Map NextActor to BlockerActor
function mapNextActorToBlockerActor(actor: NextActor): BlockerActor {
    switch (actor) {
        case NextActor.CUSTOMER:
            return BlockerActor.CUSTOMER;
        case NextActor.ADMIN:
            return BlockerActor.ADMIN;
        case NextActor.SYSTEM:
            return BlockerActor.SYSTEM;
        default:
            return BlockerActor.SYSTEM;
    }
}

// Map ActionCategory to BlockerCategory
function mapActionCategoryToBlockerCategory(
    category: ActionCategory
): BlockerCategory {
    switch (category) {
        case ActionCategory.UPLOAD:
            return BlockerCategory.UPLOAD;
        case ActionCategory.SIGNATURE:
            return BlockerCategory.SIGNATURE;
        case ActionCategory.REVIEW:
            return BlockerCategory.REVIEW;
        case ActionCategory.PAYMENT:
            return BlockerCategory.PAYMENT;
        case ActionCategory.PROCESSING:
            return BlockerCategory.PROCESSING;
        case ActionCategory.WAITING:
            return BlockerCategory.PROCESSING;
        case ActionCategory.COMPLETED:
            return BlockerCategory.PROCESSING;
        default:
            return BlockerCategory.PROCESSING;
    }
}

export interface CreateBlockerInput {
    tenantId: string;
    applicationId: string;
    phaseId?: string;
    stepId?: string;
    nextActor: NextActor;
    actionCategory: ActionCategory;
    actionRequired: string;
    context?: string;
    expectedByDate?: Date;
    metadata?: Record<string, unknown>;
}

export interface ResolveBlockerInput {
    resolvedByActor: string;
    resolutionTrigger: string;
}

export interface BlockerAnalytics {
    period: string;
    periodStart: Date;
    periodEnd: Date;
    blockersByActor: {
        actor: BlockerActor;
        count: number;
        avgDurationMs: number | null;
        overdueCount: number;
    }[];
    blockersByCategory: {
        category: BlockerCategory;
        count: number;
        avgDurationMs: number | null;
        overdueCount: number;
    }[];
    topBottlenecks: {
        stepId: string | null;
        phaseId: string | null;
        blockerCategory: BlockerCategory;
        count: number;
        avgDurationMs: number | null;
    }[];
    openBlockers: number;
    resolvedBlockers: number;
}

export class WorkflowBlockerService {
    private prisma: AnyPrismaClient;

    constructor(tenantId: string) {
        this.prisma = createTenantPrisma(defaultPrisma, { tenantId });
    }

    /**
     * Create a new workflow blocker when workflow is waiting on an actor
     */
    async createBlocker(input: CreateBlockerInput): Promise<WorkflowBlockerModel> {
        const blockerActor = mapNextActorToBlockerActor(input.nextActor);
        const blockerCategory = mapActionCategoryToBlockerCategory(
            input.actionCategory
        );

        return this.prisma.workflowBlocker.create({
            data: {
                tenantId: input.tenantId,
                applicationId: input.applicationId,
                phaseId: input.phaseId,
                stepId: input.stepId,
                blockerActor,
                blockerCategory,
                actionRequired: input.actionRequired,
                context: input.context,
                expectedByDate: input.expectedByDate,
                metadata: input.metadata as Prisma.InputJsonValue,
            },
        });
    }

    /**
     * Resolve blocker(s) for a specific step
     */
    async resolveStepBlockers(
        applicationId: string,
        stepId: string,
        resolution: ResolveBlockerInput
    ): Promise<number> {
        const now = new Date();

        // Find all open blockers for this step
        const openBlockers = await this.prisma.workflowBlocker.findMany({
            where: {
                applicationId,
                stepId,
                resolvedAt: null,
            },
        });

        if (openBlockers.length === 0) {
            return 0;
        }

        // Resolve each blocker with duration calculation
        const updatePromises = openBlockers.map((blocker: WorkflowBlockerModel) => {
            const durationMs = now.getTime() - blocker.startedAt.getTime();
            return this.prisma.workflowBlocker.update({
                where: { id: blocker.id },
                data: {
                    resolvedAt: now,
                    durationMs,
                    resolvedByActor: resolution.resolvedByActor,
                    resolutionTrigger: resolution.resolutionTrigger,
                },
            });
        });

        await Promise.all(updatePromises);
        return openBlockers.length;
    }

    /**
     * Resolve blocker(s) for a specific phase
     */
    async resolvePhaseBlockers(
        applicationId: string,
        phaseId: string,
        resolution: ResolveBlockerInput
    ): Promise<number> {
        const now = new Date();

        const openBlockers = await this.prisma.workflowBlocker.findMany({
            where: {
                applicationId,
                phaseId,
                resolvedAt: null,
            },
        });

        if (openBlockers.length === 0) {
            return 0;
        }

        const updatePromises = openBlockers.map((blocker: WorkflowBlockerModel) => {
            const durationMs = now.getTime() - blocker.startedAt.getTime();
            return this.prisma.workflowBlocker.update({
                where: { id: blocker.id },
                data: {
                    resolvedAt: now,
                    durationMs,
                    resolvedByActor: resolution.resolvedByActor,
                    resolutionTrigger: resolution.resolutionTrigger,
                },
            });
        });

        await Promise.all(updatePromises);
        return openBlockers.length;
    }

    /**
     * Resolve all blockers for an application
     */
    async resolveApplicationBlockers(
        applicationId: string,
        resolution: ResolveBlockerInput
    ): Promise<number> {
        const now = new Date();

        const openBlockers = await this.prisma.workflowBlocker.findMany({
            where: {
                applicationId,
                resolvedAt: null,
            },
        });

        if (openBlockers.length === 0) {
            return 0;
        }

        const updatePromises = openBlockers.map((blocker: WorkflowBlockerModel) => {
            const durationMs = now.getTime() - blocker.startedAt.getTime();
            return this.prisma.workflowBlocker.update({
                where: { id: blocker.id },
                data: {
                    resolvedAt: now,
                    durationMs,
                    resolvedByActor: resolution.resolvedByActor,
                    resolutionTrigger: resolution.resolutionTrigger,
                },
            });
        });

        await Promise.all(updatePromises);
        return openBlockers.length;
    }

    /**
     * Get open blockers for an application
     */
    async getOpenBlockers(applicationId: string): Promise<WorkflowBlockerModel[]> {
        return this.prisma.workflowBlocker.findMany({
            where: {
                applicationId,
                resolvedAt: null,
            },
            orderBy: { startedAt: "desc" },
        });
    }

    /**
     * Get blocker history for an application
     */
    async getBlockerHistory(applicationId: string): Promise<WorkflowBlockerModel[]> {
        return this.prisma.workflowBlocker.findMany({
            where: { applicationId },
            orderBy: { startedAt: "desc" },
        });
    }

    /**
     * Update blocker urgency based on SLA
     */
    async updateOverdueBlockers(): Promise<number> {
        const now = new Date();

        const result = await this.prisma.workflowBlocker.updateMany({
            where: {
                resolvedAt: null,
                isOverdue: false,
                expectedByDate: {
                    lt: now,
                },
            },
            data: {
                isOverdue: true,
                overdueAt: now,
                urgency: BlockerUrgency.HIGH,
            },
        });

        return result.count;
    }

    /**
     * Get blockers that need reminders
     */
    async getBlockersNeedingReminders(): Promise<WorkflowBlockerModel[]> {
        const now = new Date();

        return this.prisma.workflowBlocker.findMany({
            where: {
                resolvedAt: null,
                OR: [
                    { nextReminderAt: { lte: now } },
                    {
                        AND: [
                            { reminderCount: 0 },
                            {
                                startedAt: {
                                    lte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                                },
                            },
                        ],
                    },
                ],
            },
        });
    }

    /**
     * Record that a reminder was sent
     */
    async recordReminderSent(
        blockerId: string,
        nextReminderAt?: Date
    ): Promise<void> {
        await this.prisma.workflowBlocker.update({
            where: { id: blockerId },
            data: {
                reminderCount: { increment: 1 },
                lastReminderAt: new Date(),
                nextReminderAt,
            },
        });
    }

    /**
     * Get analytics for a tenant
     */
    async getAnalytics(
        tenantId: string,
        periodDays: number = 30
    ): Promise<BlockerAnalytics> {
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);
        const periodEnd = new Date();

        // Get all blockers in period
        const blockers = await this.prisma.workflowBlocker.findMany({
            where: {
                tenantId,
                startedAt: { gte: periodStart },
            },
        });

        // Calculate blockers by actor
        const actorGroups = new Map<
            BlockerActor,
            { count: number; totalDuration: number; overdueCount: number }
        >();
        for (const blocker of blockers) {
            const existing = actorGroups.get(blocker.blockerActor) || {
                count: 0,
                totalDuration: 0,
                overdueCount: 0,
            };
            existing.count++;
            if (blocker.durationMs) existing.totalDuration += blocker.durationMs;
            if (blocker.isOverdue) existing.overdueCount++;
            actorGroups.set(blocker.blockerActor, existing);
        }

        const blockersByActor = Array.from(actorGroups.entries()).map(
            ([actor, data]) => ({
                actor,
                count: data.count,
                avgDurationMs: data.count > 0 ? Math.round(data.totalDuration / data.count) : null,
                overdueCount: data.overdueCount,
            })
        );

        // Calculate blockers by category
        const categoryGroups = new Map<
            BlockerCategory,
            { count: number; totalDuration: number; overdueCount: number }
        >();
        for (const blocker of blockers) {
            const existing = categoryGroups.get(blocker.blockerCategory) || {
                count: 0,
                totalDuration: 0,
                overdueCount: 0,
            };
            existing.count++;
            if (blocker.durationMs) existing.totalDuration += blocker.durationMs;
            if (blocker.isOverdue) existing.overdueCount++;
            categoryGroups.set(blocker.blockerCategory, existing);
        }

        const blockersByCategory = Array.from(categoryGroups.entries()).map(
            ([category, data]) => ({
                category,
                count: data.count,
                avgDurationMs: data.count > 0 ? Math.round(data.totalDuration / data.count) : null,
                overdueCount: data.overdueCount,
            })
        );

        // Find top bottlenecks (step + category combinations)
        const bottleneckGroups = new Map<
            string,
            {
                stepId: string | null;
                phaseId: string | null;
                blockerCategory: BlockerCategory;
                count: number;
                totalDuration: number;
            }
        >();
        for (const blocker of blockers) {
            const key = `${blocker.stepId || "no-step"}:${blocker.blockerCategory}`;
            const existing = bottleneckGroups.get(key) || {
                stepId: blocker.stepId,
                phaseId: blocker.phaseId,
                blockerCategory: blocker.blockerCategory,
                count: 0,
                totalDuration: 0,
            };
            existing.count++;
            if (blocker.durationMs) existing.totalDuration += blocker.durationMs;
            bottleneckGroups.set(key, existing);
        }

        const topBottlenecks = Array.from(bottleneckGroups.values())
            .map((data) => ({
                stepId: data.stepId,
                phaseId: data.phaseId,
                blockerCategory: data.blockerCategory,
                count: data.count,
                avgDurationMs: data.count > 0 ? Math.round(data.totalDuration / data.count) : null,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const openBlockers = blockers.filter((b: WorkflowBlockerModel) => !b.resolvedAt).length;
        const resolvedBlockers = blockers.filter((b: WorkflowBlockerModel) => b.resolvedAt).length;

        return {
            period: `${periodDays} days`,
            periodStart,
            periodEnd,
            blockersByActor,
            blockersByCategory,
            topBottlenecks,
            openBlockers,
            resolvedBlockers,
        };
    }
}

/**
 * Factory function for tenant-scoped blocker service
 */
export function createWorkflowBlockerService(
    tenantId: string
): WorkflowBlockerService {
    return new WorkflowBlockerService(tenantId);
}
