import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
    EventPayload,
    EventHandler,
    EventResult,
    EventTransportType,
    EventBusConfig,
} from './event-bus.types';
import * as crypto from 'crypto';

/**
 * Event Bus Service - n8n-style event-driven architecture
 * Publishes events to various transports (HTTP, SNS, EventBridge)
 * Designed for microservices communication
 */
@Injectable()
export class EventBusService {
    private readonly logger = new Logger(EventBusService.name);
    private eventHandlers: Map<string, EventHandler[]> = new Map();
    private readonly config: EventBusConfig;

    constructor(
        private readonly httpService: HttpService,
        @Optional() @Inject('EVENT_BUS_OPTIONS') private readonly options?: any,
    ) {
        this.config = {
            defaultTransport: options?.defaultTransport || EventTransportType.HTTP,
            defaultTimeout: options?.defaultTimeout || 30000,
            defaultRetries: options?.defaultRetries || 3,
            enableDeadLetterQueue: true,
            awsRegion: options?.awsRegion || 'us-east-1',
        };
    }

    /**
     * Register an event handler/endpoint
     */
    registerHandler(handler: EventHandler): void {
        const handlers = this.eventHandlers.get(handler.eventType) || [];
        handlers.push(handler);
        this.eventHandlers.set(handler.eventType, handlers);

        this.logger.log(
            `Registered ${handler.transport} handler for event: ${handler.eventType}`
        );
    }

    /**
     * Register multiple handlers at once
     */
    registerHandlers(handlers: EventHandler[]): void {
        handlers.forEach(handler => this.registerHandler(handler));
    }

    /**
     * Publish an event to all registered handlers
     */
    async publish<T = any>(
        eventType: string,
        data: T,
        options?: {
            tenantId?: number;
            source?: string;
            metadata?: Record<string, any>;
            correlationId?: string;
        }
    ): Promise<EventResult[]> {
        const eventId = this.generateEventId();
        const payload: EventPayload<T> = {
            eventType,
            eventId,
            timestamp: new Date(),
            tenantId: options?.tenantId,
            source: options?.source || 'mortgage-fsm',
            data,
            metadata: options?.metadata,
            correlationId: options?.correlationId || eventId,
        };

        this.logger.log(`Publishing event: ${eventType} [${eventId}]`);

        const handlers = this.eventHandlers.get(eventType) || [];
        if (handlers.length === 0) {
            this.logger.warn(`No handlers registered for event: ${eventType}`);
            return [];
        }

        // Execute all handlers in parallel (fan-out pattern)
        const results = await Promise.allSettled(
            handlers.map(handler => this.executeHandler(handler, payload))
        );

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                const handler = handlers[index];
                return {
                    success: false,
                    eventId,
                    error: result.reason?.message || 'Unknown error',
                    retryCount: 0,
                    executionTime: 0,
                    transport: handler.transport,
                };
            }
        });
    }

    /**
     * Execute a single handler based on its transport type
     */
    private async executeHandler(
        handler: EventHandler,
        payload: EventPayload
    ): Promise<EventResult> {
        const startTime = Date.now();
        const retryConfig = handler.retryConfig || {
            maxRetries: this.config.defaultRetries,
            retryDelay: 1000,
            backoffMultiplier: 2,
        };

        let lastError: any;
        for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
            try {
                let response: any;

                switch (handler.transport) {
                    case EventTransportType.HTTP:
                        response = await this.executeHttpHandler(handler, payload);
                        break;
                    case EventTransportType.SNS:
                        response = await this.executeSnsHandler(handler, payload);
                        break;
                    case EventTransportType.EVENTBRIDGE:
                        response = await this.executeEventBridgeHandler(handler, payload);
                        break;
                    case EventTransportType.SQS:
                        response = await this.executeSqsHandler(handler, payload);
                        break;
                    case EventTransportType.INTERNAL:
                        response = await this.executeInternalHandler(handler, payload);
                        break;
                    default:
                        throw new Error(`Unsupported transport: ${handler.transport}`);
                }

                const executionTime = Date.now() - startTime;
                this.logger.log(
                    `Event ${payload.eventId} executed successfully via ${handler.transport} (attempt ${attempt + 1}/${retryConfig.maxRetries + 1})`
                );

                return {
                    success: true,
                    eventId: payload.eventId,
                    statusCode: response?.statusCode || 200,
                    response: response?.data,
                    retryCount: attempt,
                    executionTime,
                    transport: handler.transport,
                };
            } catch (error) {
                lastError = error;
                this.logger.error(
                    `Event ${payload.eventId} failed via ${handler.transport} (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}): ${error.message}`
                );

                if (attempt < retryConfig.maxRetries) {
                    const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
                    await this.sleep(delay);
                }
            }
        }

        // All retries exhausted
        const executionTime = Date.now() - startTime;

        // Send to dead letter queue if enabled
        if (this.config.enableDeadLetterQueue) {
            await this.sendToDeadLetterQueue(handler, payload, lastError);
        }

        return {
            success: false,
            eventId: payload.eventId,
            error: lastError?.message || 'Unknown error',
            retryCount: retryConfig.maxRetries,
            executionTime,
            transport: handler.transport,
        };
    }

    /**
     * Execute HTTP webhook call
     */
    private async executeHttpHandler(
        handler: EventHandler,
        payload: EventPayload
    ): Promise<any> {
        if (!handler.endpoint) {
            throw new Error('HTTP handler requires endpoint');
        }

        const headers = {
            'Content-Type': 'application/json',
            'X-Event-Id': payload.eventId,
            'X-Event-Type': payload.eventType,
            'X-Correlation-Id': payload.correlationId || '',
            ...(handler.headers || {}),
        };

        // Add authentication
        if (handler.authentication) {
            switch (handler.authentication.type) {
                case 'bearer':
                    headers['Authorization'] = `Bearer ${handler.authentication.credentials}`;
                    break;
                case 'api-key':
                    headers['X-API-Key'] = handler.authentication.credentials;
                    break;
                case 'basic':
                    headers['Authorization'] = `Basic ${handler.authentication.credentials}`;
                    break;
            }
        }

        const timeout = handler.timeout || this.config.defaultTimeout;

        const response = await firstValueFrom(
            this.httpService.post(handler.endpoint, payload, {
                headers,
                timeout,
            })
        );

        return {
            statusCode: response.status,
            data: response.data,
        };
    }

    /**
     * Publish to AWS SNS (placeholder - requires AWS SDK)
     */
    private async executeSnsHandler(
        handler: EventHandler,
        payload: EventPayload
    ): Promise<any> {
        if (!handler.snsTopicArn) {
            throw new Error('SNS handler requires topic ARN');
        }

        // TODO: Implement AWS SNS publishing
        // const sns = new AWS.SNS({ region: this.config.awsRegion });
        // const result = await sns.publish({
        //     TopicArn: handler.snsTopicArn,
        //     Message: JSON.stringify(payload),
        //     MessageAttributes: {
        //         eventType: { DataType: 'String', StringValue: payload.eventType },
        //         tenantId: { DataType: 'Number', StringValue: String(payload.tenantId) },
        //     }
        // }).promise();

        this.logger.warn('SNS transport not yet implemented - would publish to: ' + handler.snsTopicArn);
        return { MessageId: 'mock-sns-message-id' };
    }

    /**
     * Publish to AWS EventBridge (placeholder - requires AWS SDK)
     */
    private async executeEventBridgeHandler(
        handler: EventHandler,
        payload: EventPayload
    ): Promise<any> {
        if (!handler.eventBridgeDetail) {
            throw new Error('EventBridge handler requires event bus configuration');
        }

        // TODO: Implement AWS EventBridge publishing
        // const eventBridge = new AWS.EventBridge({ region: this.config.awsRegion });
        // const result = await eventBridge.putEvents({
        //     Entries: [{
        //         EventBusName: handler.eventBridgeDetail.eventBusName,
        //         Source: handler.eventBridgeDetail.source,
        //         DetailType: handler.eventBridgeDetail.detailType,
        //         Detail: JSON.stringify(payload),
        //     }]
        // }).promise();

        this.logger.warn('EventBridge transport not yet implemented - would publish to: ' + handler.eventBridgeDetail.eventBusName);
        return { EventId: 'mock-eventbridge-id' };
    }

    /**
     * Send to AWS SQS (placeholder - requires AWS SDK)
     */
    private async executeSqsHandler(
        handler: EventHandler,
        payload: EventPayload
    ): Promise<any> {
        if (!handler.sqsQueueUrl) {
            throw new Error('SQS handler requires queue URL');
        }

        // TODO: Implement AWS SQS sending
        this.logger.warn('SQS transport not yet implemented - would send to: ' + handler.sqsQueueUrl);
        return { MessageId: 'mock-sqs-message-id' };
    }

    /**
     * Execute internal handler function
     */
    private async executeInternalHandler(
        handler: EventHandler,
        payload: EventPayload
    ): Promise<any> {
        if (!handler.handler) {
            throw new Error('Internal handler requires handler function');
        }

        return await handler.handler(payload);
    }

    /**
     * Send failed events to dead letter queue
     */
    private async sendToDeadLetterQueue(
        handler: EventHandler,
        payload: EventPayload,
        error: any
    ): Promise<void> {
        this.logger.error(
            `Sending event ${payload.eventId} to dead letter queue after exhausting retries`
        );

        // TODO: Implement dead letter queue
        // For now, just log it
        this.logger.error({
            message: 'Dead letter event',
            eventId: payload.eventId,
            eventType: payload.eventType,
            handler: {
                transport: handler.transport,
                endpoint: handler.endpoint,
            },
            error: error?.message,
            payload,
        });
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    /**
     * Sleep helper for retries
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get all registered handlers
     */
    getHandlers(): Map<string, EventHandler[]> {
        return this.eventHandlers;
    }

    /**
     * Clear all handlers (useful for testing)
     */
    clearHandlers(): void {
        this.eventHandlers.clear();
    }
}

export default EventBusService;
