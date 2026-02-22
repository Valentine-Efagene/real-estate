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
 */

import { runDemoBootstrap } from './services/demo-bootstrap.service';
import { bootstrapService } from './services/bootstrap.service';

interface BootstrapWorkerEvent {
    mode: 'tenant' | 'demo';
    input: Record<string, unknown>;
}

export const handler = async (event: BootstrapWorkerEvent): Promise<unknown> => {
    const { mode = 'demo', input } = event;
    console.log(`[BootstrapWorker] Starting ${mode} bootstrap`);

    let result: unknown;

    if (mode === 'tenant') {
        result = await bootstrapService.bootstrapTenant(input as any);
    } else {
        result = await runDemoBootstrap(input as any);
    }

    console.log(`[BootstrapWorker] ${mode} bootstrap completed.`);
    return result;
};
