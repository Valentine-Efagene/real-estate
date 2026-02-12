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

import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { runDemoBootstrap } from './services/demo-bootstrap.service';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ROLE_POLICIES_TABLE = process.env.ROLE_POLICIES_TABLE_NAME || 'qshelter-staging-role-policies';

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
        await dynamoClient.send(new UpdateItemCommand({
            TableName: ROLE_POLICIES_TABLE,
            Key: {
                PK: { S: `BOOTSTRAP_JOB#${jobId}` },
                SK: { S: 'STATUS' },
            },
            UpdateExpression: 'SET #status = :status, updatedAt = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':status': { S: 'RUNNING' },
                ':now': { S: new Date().toISOString() },
            },
        }));
    } catch (err) {
        console.error(`[BootstrapWorker] Failed to update job status to RUNNING:`, err);
    }

    try {
        const result = await runDemoBootstrap(input);

        // Write COMPLETED + result to DynamoDB
        await dynamoClient.send(new UpdateItemCommand({
            TableName: ROLE_POLICIES_TABLE,
            Key: {
                PK: { S: `BOOTSTRAP_JOB#${jobId}` },
                SK: { S: 'STATUS' },
            },
            UpdateExpression: 'SET #status = :status, #result = :result, updatedAt = :now',
            ExpressionAttributeNames: { '#status': 'status', '#result': 'result' },
            ExpressionAttributeValues: {
                ':status': { S: 'COMPLETED' },
                ':result': { S: JSON.stringify(result) },
                ':now': { S: new Date().toISOString() },
            },
        }));

        console.log(`[BootstrapWorker] Job ${jobId} completed. ${result.steps.length} steps.`);
    } catch (error: any) {
        console.error(`[BootstrapWorker] Job ${jobId} failed:`, error);

        // Write FAILED + error to DynamoDB
        try {
            await dynamoClient.send(new UpdateItemCommand({
                TableName: ROLE_POLICIES_TABLE,
                Key: {
                    PK: { S: `BOOTSTRAP_JOB#${jobId}` },
                    SK: { S: 'STATUS' },
                },
                UpdateExpression: 'SET #status = :status, #error = :error, updatedAt = :now',
                ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
                ExpressionAttributeValues: {
                    ':status': { S: 'FAILED' },
                    ':error': { S: error.message || String(error) },
                    ':now': { S: new Date().toISOString() },
                },
            }));
        } catch (dynErr) {
            console.error(`[BootstrapWorker] Failed to write error status:`, dynErr);
        }

        // Don't throw — async invocations would retry on error
    }
};
