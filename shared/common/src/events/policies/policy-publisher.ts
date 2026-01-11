import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
    PolicyEvent,
    PolicyEventType,
    PolicyEventMeta,
    RoleData,
    PermissionData,
    RolePermissionData,
} from './policy-event';

/**
 * Configuration for the policy event publisher
 */
interface PolicyPublisherConfig {
    region?: string;
    endpoint?: string;
    topicArn?: string;
}

/**
 * Get SNS client configured for LocalStack or AWS
 */
function createSNSClient(config: PolicyPublisherConfig): SNSClient {
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
 * Policy Event Publisher for sending policy sync events to SNS
 * Used by user-service to notify policy-sync-service of changes
 */
export class PolicyEventPublisher {
    private readonly snsClient: SNSClient;
    private readonly topicArn: string;
    private readonly serviceName: string;

    constructor(serviceName: string, config?: PolicyPublisherConfig) {
        this.serviceName = serviceName;
        this.snsClient = createSNSClient(config || {});

        // Topic ARN can be passed directly or constructed from env vars
        const stage = process.env.STAGE || process.env.NODE_ENV || 'test';
        const region = config?.region || process.env.AWS_REGION || 'us-east-1';
        const accountId = process.env.AWS_ACCOUNT_ID || '000000000000';

        this.topicArn = config?.topicArn ||
            process.env.POLICY_SYNC_TOPIC_ARN ||
            `arn:aws:sns:${region}:${accountId}:qshelter-${stage}-policy-sync`;
    }

    /**
     * Publish a policy event to SNS
     */
    async publish<T>(
        eventType: PolicyEventType,
        data: T,
        meta?: Partial<PolicyEventMeta>
    ): Promise<string> {
        const eventId = crypto.randomUUID();

        const event: PolicyEvent<T> = {
            eventType,
            eventId,
            timestamp: new Date().toISOString(),
            source: this.serviceName,
            tenantId: meta?.tenantId,
            data,
            metadata: {
                correlationId: meta?.correlationId || eventId,
                userId: meta?.userId,
            },
        };

        const command = new PublishCommand({
            TopicArn: this.topicArn,
            Message: JSON.stringify(event),
            MessageAttributes: {
                eventType: {
                    DataType: 'String',
                    StringValue: eventType,
                },
                source: {
                    DataType: 'String',
                    StringValue: this.serviceName,
                },
            },
        });

        const result = await this.snsClient.send(command);
        console.log(`[PolicyEventPublisher] Published ${eventType} event to SNS`, {
            topicArn: this.topicArn,
            messageId: result.MessageId,
            eventId,
        });

        return result.MessageId || '';
    }

    /**
     * Publish role created event
     */
    async publishRoleCreated(role: RoleData, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.ROLE_CREATED, role, meta);
    }

    /**
     * Publish role updated event
     */
    async publishRoleUpdated(role: RoleData, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.ROLE_UPDATED, role, meta);
    }

    /**
     * Publish role deleted event
     */
    async publishRoleDeleted(roleId: string, roleName: string, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.ROLE_DELETED, { roleId, roleName }, meta);
    }

    /**
     * Publish permission created event
     */
    async publishPermissionCreated(permission: PermissionData, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.PERMISSION_CREATED, permission, meta);
    }

    /**
     * Publish permission updated event
     */
    async publishPermissionUpdated(permission: PermissionData, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.PERMISSION_UPDATED, permission, meta);
    }

    /**
     * Publish permission deleted event
     */
    async publishPermissionDeleted(permissionId: string, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.PERMISSION_DELETED, { permissionId }, meta);
    }

    /**
     * Publish role permission assigned event
     */
    async publishRolePermissionAssigned(data: RolePermissionData, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.ROLE_PERMISSION_ASSIGNED, data, meta);
    }

    /**
     * Publish role permission revoked event
     */
    async publishRolePermissionRevoked(data: RolePermissionData, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.ROLE_PERMISSION_REVOKED, data, meta);
    }

    /**
     * Publish full sync requested event
     */
    async publishFullSyncRequested(requestedBy: string, meta?: Partial<PolicyEventMeta>): Promise<string> {
        return this.publish(PolicyEventType.FULL_SYNC_REQUESTED, { requestedBy }, meta);
    }
}
