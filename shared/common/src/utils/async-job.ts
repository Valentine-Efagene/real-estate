/**
 * Async Job — Prisma-backed long-running job tracker
 *
 * Solves the API Gateway 30s timeout by splitting work into:
 *   1. API Lambda  → creates a PENDING job, invokes worker, returns 202 + jobId
 *   2. Worker Lambda → runs the real work, updates status to COMPLETED / FAILED
 *   3. Poll endpoint → reads current status from the database
 *
 * Usage (dispatcher — API Lambda):
 *   const store = new AsyncJobStore(prisma, 'BOOTSTRAP');
 *   const jobId = await store.create();
 *   // invoke worker with { jobId, ...payload }
 *   res.status(202).json({ jobId, status: 'PENDING' });
 *
 * Usage (worker Lambda):
 *   const store = new AsyncJobStore(prisma, 'BOOTSTRAP');
 *   await store.markRunning(jobId);
 *   try {
 *       const result = await doWork();
 *       await store.markCompleted(jobId, result);
 *   } catch (err) {
 *       await store.markFailed(jobId, err);
 *   }
 *
 * Usage (poll endpoint):
 *   const store = new AsyncJobStore(prisma, 'BOOTSTRAP');
 *   const job = await store.get(jobId);
 *   res.json(job);
 */

import { PrismaClient, AsyncJobStatus } from '../../generated/client/client';
import { randomUUID } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export { AsyncJobStatus };

export interface AsyncJob<TResult = unknown> {
    jobId: string;
    jobType: string;
    status: AsyncJobStatus;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date | null;
    completedAt?: Date | null;
    result?: TResult;
    error?: string | null;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export class AsyncJobStore {
    /**
     * @param prisma   - Prisma client instance
     * @param jobType  - Job type namespace, e.g. 'BOOTSTRAP', 'BULK_IMPORT'
     * @param tenantId - Optional tenant ID for tenant-scoped jobs
     */
    constructor(
        private readonly prisma: PrismaClient,
        private readonly jobType: string,
        private readonly tenantId?: string | null,
    ) { }

    /** Create a PENDING job and return its ID. */
    async create(jobId?: string): Promise<string> {
        const id = jobId ?? randomUUID();

        await this.prisma.asyncJob.create({
            data: {
                id,
                jobType: this.jobType,
                status: 'PENDING',
                tenantId: this.tenantId ?? null,
            },
        });

        return id;
    }

    /** Transition job to RUNNING. */
    async markRunning(jobId: string): Promise<void> {
        await this.prisma.asyncJob.update({
            where: { id: jobId },
            data: {
                status: 'RUNNING',
                startedAt: new Date(),
            },
        });
    }

    /** Transition job to COMPLETED with a JSON-serialisable result. */
    async markCompleted(jobId: string, result: unknown): Promise<void> {
        await this.prisma.asyncJob.update({
            where: { id: jobId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                result: result as any,
            },
        });
    }

    /** Transition job to FAILED with an error message. */
    async markFailed(jobId: string, error: unknown): Promise<void> {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.asyncJob.update({
            where: { id: jobId },
            data: {
                status: 'FAILED',
                completedAt: new Date(),
                error: message,
            },
        });
    }

    /** Read current job state. Returns null if not found. */
    async get<TResult = unknown>(jobId: string): Promise<AsyncJob<TResult> | null> {
        const row = await this.prisma.asyncJob.findUnique({
            where: { id: jobId },
        });

        if (!row) return null;

        return {
            jobId: row.id,
            jobType: row.jobType,
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            result: row.result as TResult | undefined,
            error: row.error,
        };
    }

    /** List recent jobs of this type, newest first. */
    async list(limit: number = 10): Promise<AsyncJob[]> {
        const rows = await this.prisma.asyncJob.findMany({
            where: {
                jobType: this.jobType,
                ...(this.tenantId ? { tenantId: this.tenantId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return rows.map((row) => ({
            jobId: row.id,
            jobType: row.jobType,
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            result: row.result as unknown,
            error: row.error,
        }));
    }

    /** Delete completed/failed jobs older than the given age. */
    async cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
        const cutoff = new Date(Date.now() - olderThanMs);

        const result = await this.prisma.asyncJob.deleteMany({
            where: {
                jobType: this.jobType,
                status: { in: ['COMPLETED', 'FAILED'] },
                updatedAt: { lt: cutoff },
            },
        });

        return result.count;
    }
}
