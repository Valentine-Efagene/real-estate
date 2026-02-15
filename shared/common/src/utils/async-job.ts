/**
 * Async Job — DynamoDB-backed long-running job tracker
 *
 * Solves the API Gateway 30s timeout by splitting work into:
 *   1. API Lambda  → creates a PENDING job, invokes worker, returns 202 + jobId
 *   2. Worker Lambda → runs the real work, updates status to COMPLETED / FAILED
 *   3. Poll endpoint → reads current status from DynamoDB
 *
 * Usage (dispatcher — API Lambda):
 *   const store = new AsyncJobStore(dynamoClient, tableName, 'MY_JOB');
 *   const jobId = await store.create();
 *   // invoke worker with { jobId, ...payload }
 *   res.status(202).json({ jobId, status: 'PENDING' });
 *
 * Usage (worker Lambda):
 *   const store = new AsyncJobStore(dynamoClient, tableName, 'MY_JOB');
 *   await store.markRunning(jobId);
 *   try {
 *       const result = await doWork();
 *       await store.markCompleted(jobId, result);
 *   } catch (err) {
 *       await store.markFailed(jobId, err);
 *   }
 *
 * Usage (poll endpoint):
 *   const store = new AsyncJobStore(dynamoClient, tableName, 'MY_JOB');
 *   const job = await store.get(jobId);
 *   res.json(job);
 */

import {
    DynamoDBClient,
    PutItemCommand,
    GetItemCommand,
    UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AsyncJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface AsyncJob<TResult = unknown> {
    jobId: string;
    status: AsyncJobStatus;
    createdAt: string;
    updatedAt: string;
    result?: TResult;
    error?: string;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export class AsyncJobStore {
    /**
     * @param dynamo   - DynamoDB client instance
     * @param table    - DynamoDB table name (single-table design with PK/SK)
     * @param prefix   - Key prefix to namespace jobs, e.g. 'BOOTSTRAP_JOB'
     */
    constructor(
        private readonly dynamo: DynamoDBClient,
        private readonly table: string,
        private readonly prefix: string,
    ) { }

    /** Create a PENDING job and return its ID. */
    async create(jobId?: string): Promise<string> {
        const id = jobId ?? randomUUID();
        const now = new Date().toISOString();

        await this.dynamo.send(new PutItemCommand({
            TableName: this.table,
            Item: {
                PK: { S: `${this.prefix}#${id}` },
                SK: { S: 'STATUS' },
                status: { S: 'PENDING' as AsyncJobStatus },
                createdAt: { S: now },
                updatedAt: { S: now },
            },
        }));

        return id;
    }

    /** Transition job to RUNNING. */
    async markRunning(jobId: string): Promise<void> {
        await this.updateStatus(jobId, 'RUNNING');
    }

    /** Transition job to COMPLETED with a JSON-serialisable result. */
    async markCompleted(jobId: string, result: unknown): Promise<void> {
        await this.dynamo.send(new UpdateItemCommand({
            TableName: this.table,
            Key: this.key(jobId),
            UpdateExpression: 'SET #status = :status, #result = :result, updatedAt = :now',
            ExpressionAttributeNames: { '#status': 'status', '#result': 'result' },
            ExpressionAttributeValues: {
                ':status': { S: 'COMPLETED' as AsyncJobStatus },
                ':result': { S: JSON.stringify(result) },
                ':now': { S: new Date().toISOString() },
            },
        }));
    }

    /** Transition job to FAILED with an error message. */
    async markFailed(jobId: string, error: unknown): Promise<void> {
        const message = error instanceof Error ? error.message : String(error);
        await this.dynamo.send(new UpdateItemCommand({
            TableName: this.table,
            Key: this.key(jobId),
            UpdateExpression: 'SET #status = :status, #error = :error, updatedAt = :now',
            ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
            ExpressionAttributeValues: {
                ':status': { S: 'FAILED' as AsyncJobStatus },
                ':error': { S: message },
                ':now': { S: new Date().toISOString() },
            },
        }));
    }

    /** Read current job state. Returns null if not found. */
    async get<TResult = unknown>(jobId: string): Promise<AsyncJob<TResult> | null> {
        const res = await this.dynamo.send(new GetItemCommand({
            TableName: this.table,
            Key: this.key(jobId),
        }));

        if (!res.Item) return null;

        const status = (res.Item.status?.S ?? 'UNKNOWN') as AsyncJobStatus;
        const job: AsyncJob<TResult> = {
            jobId,
            status,
            createdAt: res.Item.createdAt?.S ?? '',
            updatedAt: res.Item.updatedAt?.S ?? '',
        };

        if (status === 'COMPLETED' && res.Item.result?.S) {
            job.result = JSON.parse(res.Item.result.S) as TResult;
        }
        if (status === 'FAILED' && res.Item.error?.S) {
            job.error = res.Item.error.S;
        }

        return job;
    }

    // ── Internals ───────────────────────────────────────────────────────

    private key(jobId: string) {
        return {
            PK: { S: `${this.prefix}#${jobId}` },
            SK: { S: 'STATUS' },
        };
    }

    private async updateStatus(jobId: string, status: AsyncJobStatus): Promise<void> {
        await this.dynamo.send(new UpdateItemCommand({
            TableName: this.table,
            Key: this.key(jobId),
            UpdateExpression: 'SET #status = :status, updatedAt = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':status': { S: status },
                ':now': { S: new Date().toISOString() },
            },
        }));
    }
}
