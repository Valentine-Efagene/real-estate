/**
 * Event Bus Types
 *
 * Type definitions for the EventBus system.
 */

export enum EventTransportType {
    HTTP = 'http',              // Direct HTTP webhook call
    SNS = 'sns',                // AWS SNS topic
    EVENTBRIDGE = 'eventbridge', // AWS EventBridge
    SQS = 'sqs',                // AWS SQS queue
    INTERNAL = 'internal',       // In-process handler
}

export enum EventStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SUCCESS = 'success',
    FAILED = 'failed',
    RETRY = 'retry',
    DEAD_LETTER = 'dead_letter',
}

export interface EventPayload<T = any> {
    eventType: string;
    eventId: string;
    timestamp: Date;
    tenantId?: number;
    source: string;
    data: T;
    metadata?: Record<string, any>;
    correlationId?: string;
    causationId?: string;
}

export interface EventHandler {
    eventType: string;
    transport: EventTransportType;
    endpoint?: string;          // HTTP endpoint URL
    snsTopicArn?: string;       // SNS topic ARN
    eventBridgeDetail?: {
        eventBusName: string;
        source: string;
        detailType: string;
    };
    sqsQueueUrl?: string;       // SQS queue URL
    handler?: (payload: EventPayload) => Promise<any>; // Internal handler
    retryConfig?: {
        maxRetries: number;
        retryDelay: number;     // milliseconds
        backoffMultiplier: number;
    };
    timeout?: number;           // milliseconds
    headers?: Record<string, string>;
    authentication?: {
        type: 'bearer' | 'api-key' | 'basic';
        credentials: string;
    };
}

export interface EventBusConfig {
    defaultTransport: EventTransportType;
    defaultTimeout: number;
    defaultRetries: number;
    enableDeadLetterQueue: boolean;
    deadLetterQueueUrl?: string;
    awsRegion?: string;
}

export interface EventResult {
    success: boolean;
    eventId: string;
    statusCode?: number;
    response?: any;
    error?: string;
    retryCount: number;
    executionTime: number;
    transport: EventTransportType;
}
