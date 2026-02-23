/**
 * Bootstrap Worker Lambda
 *
 * Standalone Lambda function (NOT behind API Gateway) that runs bootstrap
 * operations asynchronously. Supports two modes:
 *
 *  - `tenant`  — runs bootstrapService.bootstrapTenant() (tenant + roles + admin)
 *  - `demo`    — runs the full demo-bootstrap orchestration (reset + tenant + orgs + property + payment method)
 *
 * Invoked asynchronously by the API Lambda so it can run for up to 300s
 * without hitting the 30s API Gateway timeout.
 *
 * Uses AsyncJobStore to track job status so the API can poll for completion.
 */

import { runDemoBootstrap } from './services/demo-bootstrap.service';
import { bootstrapService } from './services/bootstrap.service';
import { AsyncJobStore } from '@valentine-efagene/qshelter-common';
import { prisma } from './lib/prisma';

interface BootstrapWorkerEvent {
    mode: 'tenant' | 'demo';
    jobId?: string;
    input: Record<string, unknown>;
}

export const handler = async (event: BootstrapWorkerEvent): Promise<unknown> => {
    const { mode = 'demo', jobId, input } = event;
    console.log(`[BootstrapWorker] Starting ${mode} bootstrap (jobId: ${jobId || 'none'})`);

    const jobType = mode === 'tenant' ? 'BOOTSTRAP' : 'DEMO_BOOTSTRAP';
    const jobStore = jobId ? new AsyncJobStore(prisma, jobType) : null;

    try {
        // Mark job as running
        if (jobStore && jobId) {
            await jobStore.markRunning(jobId);
        }

        let result: unknown;

        if (mode === 'tenant') {
            result = await bootstrapService.bootstrapTenant(input as any);
        } else {
            result = await runDemoBootstrap(input as any);
        }

        // Mark job as completed with the result
        if (jobStore && jobId) {
            await jobStore.markCompleted(jobId, result);
        }

        console.log(`[BootstrapWorker] ${mode} bootstrap completed.`);
        return result;
    } catch (error) {
        console.error(`[BootstrapWorker] ${mode} bootstrap failed:`, error);

        // Mark job as failed
        if (jobStore && jobId) {
            await jobStore.markFailed(jobId, error);
        }

        throw error;
    }
};
