/**
 * Bootstrap Worker Lambda
 *
 * Standalone Lambda function (NOT behind API Gateway) that runs the
 * demo-bootstrap orchestration. Invoked asynchronously by the API Lambda
 * so it can run for up to 120s without hitting the 30s API Gateway timeout.
 *
 * Event shape:
 * {
 *   jobId: string;
 *   input: DemoBootstrapInput;
 * }
 *
 * On completion, writes the result to DynamoDB so the API can poll for it.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { AsyncJobStore } from '@valentine-efagene/qshelter-common';
import { runDemoBootstrap } from './services/demo-bootstrap.service';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ROLE_POLICIES_TABLE = process.env.ROLE_POLICIES_TABLE_NAME || 'qshelter-staging-role-policies';

const jobStore = new AsyncJobStore(dynamoClient, ROLE_POLICIES_TABLE, 'BOOTSTRAP_JOB');

interface BootstrapWorkerEvent {
    jobId: string;
    input: {
        propertyServiceUrl: string;
        mortgageServiceUrl: string;
        paymentServiceUrl: string;
    };
}

export const handler = async (event: BootstrapWorkerEvent): Promise<void> => {
    const { jobId, input } = event;
    console.log(`[BootstrapWorker] Starting job ${jobId}`);

    // Mark job as RUNNING
    try {
        await jobStore.markRunning(jobId);
    } catch (err) {
        console.error(`[BootstrapWorker] Failed to update job status to RUNNING:`, err);
    }

    try {
        const result = await runDemoBootstrap(input);
        await jobStore.markCompleted(jobId, result);
        console.log(`[BootstrapWorker] Job ${jobId} completed. ${result.steps.length} steps.`);
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
