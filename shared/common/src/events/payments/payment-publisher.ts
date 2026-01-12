import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
    PaymentEvent,
    PaymentEventType,
    PaymentEventMeta,
} from './payment-event';

/**
 * Configuration for the payment event publisher
 */
interface PaymentPublisherConfig {
    region?: string;
    endpoint?: string;
    topicArn?: string;
}

/**
 * Get SNS client configured for LocalStack or AWS
 */
function createSNSClient(config: PaymentPublisherConfig): SNSClient {
    const endpoint = config.endpoint || process.env.LOCALSTACK_ENDPOINT;
    const region = config.region || process.env.AWS_REGION || 'us-east-1';

    const clientConfig: { region: string; endpoint?: string } = { region };

    // For LocalStack, set custom endpoint
    if (endpoint) {
        clientConfig.endpoint = endpoint;
    }

    return new SNSClient(clientConfig);
}

/**
 * Payment Event Publisher for sending payment events to SNS
 * Used by payment-service and mortgage-service to communicate
 */
export class PaymentEventPublisher {
    private readonly snsClient: SNSClient;
    private readonly topicArn: string;
    private readonly serviceName: string;

    constructor(serviceName: string, config?: PaymentPublisherConfig) {
        this.serviceName = serviceName;
        this.snsClient = createSNSClient(config || {});

        // Topic ARN can be passed directly or constructed from env vars
        const stage = process.env.STAGE || process.env.NODE_ENV || 'test';
        const region = config?.region || process.env.AWS_REGION || 'us-east-1';
        const accountId = process.env.AWS_ACCOUNT_ID || '000000000000';

        this.topicArn = config?.topicArn ||
            process.env.PAYMENTS_TOPIC_ARN ||
            `arn:aws:sns:${region}:${accountId}:qshelter-${stage}-payments`;
    }

    /**
     * Publish a payment event to SNS
     */
    async publish<T>(
        type: PaymentEventType,
        payload: T,
        meta?: Partial<PaymentEventMeta>
    ): Promise<string> {
        const event: PaymentEvent<T> = {
            type,
            payload,
            meta: {
                source: this.serviceName,
                timestamp: new Date().toISOString(),
                correlationId: meta?.correlationId || crypto.randomUUID(),
                userId: meta?.userId,
                tenantId: meta?.tenantId,
            },
        };

        const command = new PublishCommand({
            TopicArn: this.topicArn,
            Message: JSON.stringify(event),
            MessageAttributes: {
                eventType: {
                    DataType: 'String',
                    StringValue: type,
                },
                source: {
                    DataType: 'String',
                    StringValue: this.serviceName,
                },
            },
        });

        const result = await this.snsClient.send(command);
        console.log(`[PaymentEventPublisher] Published ${type} event to SNS`, {
            topicArn: this.topicArn,
            messageId: result.MessageId,
            correlationId: event.meta.correlationId,
        });

        return result.MessageId || '';
    }

    /**
     * Publish wallet credited event
     */
    async publishWalletCredited(payload: {
        walletId: string;
        userId: string;
        transactionId: string;
        amount: number;
        currency: string;
        newBalance: number;
        reference: string;
        source: 'virtual_account' | 'manual' | 'refund';
    }, meta?: Partial<PaymentEventMeta>): Promise<string> {
        return this.publish(PaymentEventType.WALLET_CREDITED, payload, {
            ...meta,
            userId: payload.userId,
        });
    }

    /**
     * Publish allocate to installments command
     */
    async publishAllocateToInstallments(payload: {
        userId: string;
        walletId: string;
        applicationId?: string;
        maxAmount?: number;
    }, meta?: Partial<PaymentEventMeta>): Promise<string> {
        return this.publish(PaymentEventType.ALLOCATE_TO_INSTALLMENTS, payload, {
            ...meta,
            userId: payload.userId,
        });
    }
}
