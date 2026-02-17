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
 * On completion, writes the result to DynamoDB so the API can poll for it.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { AsyncJobStore } from '@valentine-efagene/qshelter-common';
import { runDemoBootstrap, waitForPolicies } from './services/demo-bootstrap.service';
import { bootstrapService } from './services/bootstrap.service';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ROLE_POLICIES_TABLE = process.env.ROLE_POLICIES_TABLE_NAME || 'qshelter-staging-role-policies';

const jobStore = new AsyncJobStore(dynamoClient, ROLE_POLICIES_TABLE, 'BOOTSTRAP_JOB');

interface BootstrapWorkerEvent {
    jobId: string;
    mode: 'tenant' | 'demo';
    input: Record<string, unknown>;
}

export const handler = async (event: BootstrapWorkerEvent): Promise<void> => {
    const { jobId, mode = 'demo', input } = event;
    console.log(`[BootstrapWorker] Starting ${mode} job ${jobId}`);

    try {
        await jobStore.markRunning(jobId);
    } catch (err) {
        console.error(`[BootstrapWorker] Failed to update job status to RUNNING:`, err);
    }

    try {
        let result: unknown;

        if (mode === 'tenant') {
            result = await bootstrapService.bootstrapTenant(input as any);

            // Wait for policies to land in DynamoDB before marking COMPLETED.
            // bootstrapTenant() publishes SNS events but returns immediately;
            // the SNS → SQS → policy-sync Lambda → DynamoDB pipeline needs time.
            const tenantResult = result as { tenant: { id: string }; roles: Array<{ name: string }> };
            const roleNames = tenantResult.roles.map((r) => r.name);
            const pollResult = await waitForPolicies(tenantResult.tenant.id, roleNames);
            if (!pollResult.foundAll) {
                console.warn(
                    `[BootstrapWorker] Policy sync incomplete after ${pollResult.elapsed}ms. Missing: ${pollResult.missing.join(', ')}`,
                );
            } else {
                console.log(
                    `[BootstrapWorker] All ${roleNames.length} role policies synced in ${pollResult.elapsed}ms`,
                );
            }
        } else {
            result = await runDemoBootstrap(input as any);
        }

        await jobStore.markCompleted(jobId, result);
        console.log(`[BootstrapWorker] Job ${jobId} (${mode}) completed.`);
    } catch (error: any) {
        console.error(`[BootstrapWorker] Job ${jobId} failed:`, error);

        try {
            await jobStore.markFailed(jobId, error);
        } catch (dynErr) {
            console.error(`[BootstrapWorker] Failed to write error status:`, dynErr);
        }

        // Don't throw — async invocations would retry on error
    }
};
