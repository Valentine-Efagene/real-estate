import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { PrismaClient } from '@valentine-efagene/qshelter-common';
import { v4 as uuidv4 } from 'uuid';

let sns: SNSClient | null = new SNSClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.LOCALSTACK_ENDPOINT, // optional for local dev
});

/**
 * Get or create the SNS client (lazy initialization)
 */
function getSNSClient(): SNSClient {
    if (!sns) {
        sns = new SNSClient({
            region: process.env.AWS_REGION || 'us-east-1',
            endpoint: process.env.LOCALSTACK_ENDPOINT,
        });
    }
    return sns;
}

/**
 * Destroy the SNS client to allow process to exit cleanly (for tests)
 */
export function destroySNSClient(): void {
    if (sns) {
        sns.destroy();
        sns = null;
    }
}

export interface OutboxEnqueueOptions<T> {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    queueName: string;
    payload: T;
    tenantId: string;
    actorId?: string;
    actorRole?: string;
}

/**
 * Enqueue a domain event inside an existing transaction (atomic with domain write).
 * Uses the DomainEvent model as outbox.
 */
export async function enqueueOutboxInTx<T>(
    tx: Pick<PrismaClient, 'domainEvent'>,
    opts: OutboxEnqueueOptions<T>
): Promise<string> {
    const id = uuidv4();
    await tx.domainEvent.create({
        data: {
            id,
            tenantId: opts.tenantId,
            eventType: opts.eventType,
            aggregateType: opts.aggregateType,
            aggregateId: opts.aggregateId,
            queueName: opts.queueName,
            payload: JSON.stringify(opts.payload),
            actorId: opts.actorId,
            actorRole: opts.actorRole,
            status: 'PENDING',
            failureCount: 0,
        },
    });
    return id;
}

/**
 * Attempt immediate publish to SNS and update outbox row (audit).
 * This will not retry indefinitely — operator can redrive via console.
 */
export async function publishOutboxNow(
    prisma: PrismaClient,
    outboxId: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    const row = await prisma.domainEvent.findUnique({ where: { id: outboxId } });
    if (!row) return { ok: false, error: 'not_found' };

    // Build topic ARN from queueName (convention: topic name = queueName)
    const topicArn = buildTopicArn(row.queueName);

    try {
        const resp = await getSNSClient().send(
            new PublishCommand({
                TopicArn: topicArn,
                Message: JSON.stringify({
                    type: row.eventType,
                    aggregateType: row.aggregateType,
                    aggregateId: row.aggregateId,
                    payload: JSON.parse(row.payload),
                    outboxId: row.id,
                    occurredAt: row.occurredAt.toISOString(),
                    actorId: row.actorId,
                    actorRole: row.actorRole,
                }),
                MessageAttributes: {
                    eventType: { DataType: 'String', StringValue: row.eventType },
                    aggregateType: { DataType: 'String', StringValue: row.aggregateType },
                },
            })
        );

        await prisma.domainEvent.update({
            where: { id: outboxId },
            data: {
                status: 'SENT',
                sentAt: new Date(),
                failureCount: { increment: 1 },
            },
        });

        console.info('Outbox publish succeeded', { outboxId, snsMessageId: resp.MessageId });
        return { ok: true, messageId: resp.MessageId };
    } catch (err: any) {
        await prisma.domainEvent.update({
            where: { id: outboxId },
            data: {
                status: 'FAILED',
                failureCount: { increment: 1 },
                lastError: String(err?.message ?? err),
            },
        });

        console.error('Outbox publish failed', { outboxId, error: String(err?.message ?? err) });
        return { ok: false, error: String(err?.message ?? err) };
    }
}

/**
 * Build SNS topic ARN from queue/topic name
 */
function buildTopicArn(queueName: string): string {
    const region = process.env.AWS_REGION || 'us-east-1';
    const accountId = process.env.AWS_ACCOUNT_ID || '000000000000';
    return `arn:aws:sns:${region}:${accountId}:${queueName}`;
}

/**
 * Convenience: enqueue in transaction then attempt immediate publish after commit.
 * Call this after tx.$transaction() completes.
 */
export async function publishAfterCommit(
    prisma: PrismaClient,
    outboxId: string
): Promise<void> {
    const result = await publishOutboxNow(prisma, outboxId);
    if (!result.ok) {
        console.warn('Immediate publish failed; outbox retained for audit/redrive', {
            outboxId,
            error: result.error,
        });
    }
}
