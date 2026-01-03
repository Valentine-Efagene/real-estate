import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { NotificationEvent, NotificationMeta } from './notification-event';
import { NotificationType, NotificationChannel } from './notification-enums';

/**
 * Configuration for the event publisher
 */
interface EventPublisherConfig {
    region?: string;
    endpoint?: string;
    topicArn?: string;
}

/**
 * Get SNS client configured for LocalStack or AWS
 */
function createSNSClient(config: EventPublisherConfig): SNSClient {
    const isLocalStack = process.env.LOCALSTACK_ENDPOINT || process.env.NODE_ENV === 'test';

    const clientConfig: any = {
        region: config.region || process.env.AWS_REGION || 'us-east-1',
    };

    if (isLocalStack) {
        clientConfig.endpoint = config.endpoint || process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
        clientConfig.credentials = {
            accessKeyId: 'test',
            secretAccessKey: 'test',
        };
    }

    return new SNSClient(clientConfig);
}

/**
 * Event Publisher for sending notification events to SNS
 * Used by all services to publish events to the notifications topic
 */
export class EventPublisher {
    private readonly snsClient: SNSClient;
    private readonly topicArn: string;
    private readonly serviceName: string;

    constructor(serviceName: string, config?: EventPublisherConfig) {
        this.serviceName = serviceName;
        this.snsClient = createSNSClient(config || {});

        // Topic ARN can be passed directly or constructed from env vars
        const stage = process.env.STAGE || process.env.NODE_ENV || 'test';
        const region = config?.region || process.env.AWS_REGION || 'us-east-1';
        const accountId = process.env.AWS_ACCOUNT_ID || '000000000000';

        this.topicArn = config?.topicArn ||
            process.env.NOTIFICATIONS_TOPIC_ARN ||
            `arn:aws:sns:${region}:${accountId}:qshelter-${stage}-notifications`;
    }

    /**
     * Publish a notification event to SNS
     */
    async publish<T>(
        type: NotificationType,
        channel: NotificationChannel,
        payload: T,
        meta?: Partial<NotificationMeta>
    ): Promise<string> {
        const event: NotificationEvent<T> = {
            type,
            channel,
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
                notificationType: {
                    DataType: 'String',
                    StringValue: type,
                },
                channel: {
                    DataType: 'String',
                    StringValue: channel,
                },
                source: {
                    DataType: 'String',
                    StringValue: this.serviceName,
                },
            },
        });

        const result = await this.snsClient.send(command);
        console.log(`[EventPublisher] Published ${type} event to SNS`, {
            messageId: result.MessageId,
            type,
            channel,
            source: this.serviceName,
        });

        return result.MessageId || '';
    }

    /**
     * Convenience method for publishing email notifications
     */
    async publishEmail<T>(
        type: NotificationType,
        payload: T,
        meta?: Partial<NotificationMeta>
    ): Promise<string> {
        return this.publish(type, NotificationChannel.EMAIL, payload, meta);
    }

    /**
     * Convenience method for publishing SMS notifications
     */
    async publishSMS<T>(
        type: NotificationType,
        payload: T,
        meta?: Partial<NotificationMeta>
    ): Promise<string> {
        return this.publish(type, NotificationChannel.SMS, payload, meta);
    }

    /**
     * Convenience method for publishing push notifications
     */
    async publishPush<T>(
        type: NotificationType,
        payload: T,
        meta?: Partial<NotificationMeta>
    ): Promise<string> {
        return this.publish(type, NotificationChannel.PUSH, payload, meta);
    }
}

// Singleton instances per service
const publisherInstances = new Map<string, EventPublisher>();

/**
 * Get or create an EventPublisher for a service
 */
export function getEventPublisher(serviceName: string, config?: EventPublisherConfig): EventPublisher {
    if (!publisherInstances.has(serviceName)) {
        publisherInstances.set(serviceName, new EventPublisher(serviceName, config));
    }
    return publisherInstances.get(serviceName)!;
}
