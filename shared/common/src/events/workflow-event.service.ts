/**
 * Workflow Event Service
 *
 * Handles emission and processing of workflow events.
 * Events are stored in the database and processed by registered handlers.
 *
 * Design principles:
 * 1. Events are immutable once emitted
 * 2. Handlers are configured by admins, not hardcoded
 * 3. Each handler execution is logged for audit
 * 4. Failed handlers can be retried
 * 5. Events can be correlated for tracing
 *
 * Usage:
 * ```typescript
 * const eventService = new WorkflowEventService(prisma);
 *
 * // Emit an event
 * const event = await eventService.emit(tenantId, {
 *   eventType: 'DOCUMENT_UPLOADED',
 *   payload: {
 *     contractId: 'ctr_123',
 *     stepId: 'step_456',
 *     documentUrl: 'https://...',
 *   },
 *   source: 'contract-service',
 *   actor: { id: 'user_789', type: 'USER' },
 * });
 *
 * // Process the event (run all handlers)
 * const result = await eventService.processEvent(event.id);
 * ```
 */

import { PrismaClient } from '../../generated/client/client';
import type {
    EmitEventInput,
    WorkflowEventData,
    ProcessEventResult,
    HandlerConfig,
    InternalHandlerConfig,
    WebhookHandlerConfig,
    WorkflowHandlerConfig,
    NotificationHandlerConfig,
} from './workflow-types';

/**
 * Service registry interface for internal handlers
 */
export interface ServiceRegistry {
    get(serviceName: string): any | undefined;
    register(serviceName: string, service: any): void;
}

/**
 * Simple in-memory service registry
 */
class InMemoryServiceRegistry implements ServiceRegistry {
    private services = new Map<string, any>();

    get(serviceName: string): any | undefined {
        return this.services.get(serviceName);
    }

    register(serviceName: string, service: any): void {
        this.services.set(serviceName, service);
    }
}

export class WorkflowEventService {
    private serviceRegistry: ServiceRegistry;

    constructor(
        private prisma: PrismaClient,
        serviceRegistry?: ServiceRegistry
    ) {
        this.serviceRegistry = serviceRegistry || new InMemoryServiceRegistry();
    }

    /**
     * Register a service for internal event handlers
     *
     * Services can be called by INTERNAL handler type configurations.
     * The service should expose methods that match the handler config.
     */
    registerService(name: string, service: any): void {
        this.serviceRegistry.register(name, service);
    }

    /**
     * Emit an event
     *
     * This creates an event record and optionally processes it immediately
     * or leaves it for async processing by a worker.
     *
     * @param tenantId - Tenant context
     * @param input - Event details
     * @param processImmediately - Whether to process handlers now (default: false)
     */
    async emit(
        tenantId: string,
        input: EmitEventInput,
        processImmediately = false
    ): Promise<WorkflowEventData> {
        // Look up the event type by code
        const eventType = await this.prisma.eventType.findFirst({
            where: {
                tenantId,
                code: input.eventType.toUpperCase(),
                enabled: true,
                channel: { enabled: true },
            },
            include: {
                channel: true,
            },
        });

        if (!eventType) {
            throw new Error(`Event type '${input.eventType}' not found or not enabled for tenant`);
        }

        // TODO: Validate payload against schema if defined
        // if (eventType.payloadSchema) {
        //   validateJsonSchema(input.payload, eventType.payloadSchema);
        // }

        // Create the event record
        const event = await this.prisma.workflowEvent.create({
            data: {
                tenantId,
                eventTypeId: eventType.id,
                payload: input.payload as any,
                source: input.source,
                actorId: input.actor?.id,
                actorType: input.actor?.type || 'SYSTEM',
                correlationId: input.correlationId,
                causationId: input.causationId,
                status: 'PENDING',
            },
            include: {
                eventType: {
                    include: { channel: true },
                },
            },
        }) as any;

        const result: WorkflowEventData = {
            id: event.id,
            tenantId: event.tenantId,
            eventTypeId: event.eventTypeId,
            eventTypeCode: event.eventType.code,
            channelCode: event.eventType.channel.code,
            payload: event.payload as Record<string, unknown>,
            source: event.source,
            actorId: event.actorId,
            actorType: event.actorType as any,
            status: event.status as any,
            correlationId: event.correlationId,
            causationId: event.causationId,
            error: event.error,
            processedAt: event.processedAt,
            createdAt: event.createdAt,
        };

        // Process immediately if requested
        if (processImmediately) {
            await this.processEvent(event.id);
        }

        return result;
    }

    /**
     * Process an event by executing all registered handlers
     *
     * This is typically called by a worker/queue processor,
     * but can also be called synchronously for simple cases.
     */
    async processEvent(eventId: string): Promise<ProcessEventResult> {
        // Fetch the event with its type and handlers
        const event = await this.prisma.workflowEvent.findUnique({
            where: { id: eventId },
            include: {
                eventType: {
                    include: {
                        handlers: {
                            where: { enabled: true },
                            orderBy: { priority: 'asc' },
                        },
                    },
                },
            },
        });

        if (!event) {
            throw new Error(`Event ${eventId} not found`);
        }

        // Mark as processing
        await this.prisma.workflowEvent.update({
            where: { id: eventId },
            data: { status: 'PROCESSING' },
        });

        const handlers = event.eventType.handlers;
        const errors: ProcessEventResult['errors'] = [];
        let handlersSucceeded = 0;
        let handlersFailed = 0;

        // Execute each handler in priority order
        for (const handler of handlers) {
            // Check filter condition
            if (handler.filterCondition) {
                const shouldRun = this.evaluateFilterCondition(
                    handler.filterCondition,
                    event.payload as Record<string, unknown>
                );
                if (!shouldRun) {
                    // Log as skipped
                    await this.prisma.eventHandlerExecution.create({
                        data: {
                            eventId: event.id,
                            handlerId: handler.id,
                            status: 'SKIPPED',
                            input: event.payload as object,
                        },
                    });
                    continue;
                }
            }

            // Create execution record
            const execution = await this.prisma.eventHandlerExecution.create({
                data: {
                    eventId: event.id,
                    handlerId: handler.id,
                    status: 'RUNNING',
                    input: event.payload as object,
                    startedAt: new Date(),
                },
            });

            try {
                // Execute the handler based on type
                const output = await this.executeHandler(
                    handler.handlerType as any,
                    handler.config as any,
                    event.payload as Record<string, unknown>,
                    event.tenantId
                );

                // Mark as completed
                const completedAt = new Date();
                await this.prisma.eventHandlerExecution.update({
                    where: { id: execution.id },
                    data: {
                        status: 'COMPLETED',
                        output: output as object,
                        completedAt,
                        durationMs: completedAt.getTime() - execution.startedAt!.getTime(),
                    },
                });

                handlersSucceeded++;
            } catch (error: any) {
                // Mark as failed
                const completedAt = new Date();
                await this.prisma.eventHandlerExecution.update({
                    where: { id: execution.id },
                    data: {
                        status: 'FAILED',
                        error: error.message,
                        errorCode: error.code,
                        completedAt,
                        durationMs: completedAt.getTime() - execution.startedAt!.getTime(),
                    },
                });

                errors.push({
                    handlerId: handler.id,
                    handlerName: handler.name,
                    error: error.message,
                });
                handlersFailed++;

                // TODO: Implement retry logic based on handler.maxRetries and handler.retryDelayMs
            }
        }

        // Update event status
        const finalStatus =
            handlersFailed > 0
                ? handlersSucceeded > 0
                    ? 'COMPLETED' // Partial success still counts as completed
                    : 'FAILED'
                : 'COMPLETED';

        await this.prisma.workflowEvent.update({
            where: { id: eventId },
            data: {
                status: finalStatus,
                processedAt: new Date(),
                error: errors.length > 0 ? JSON.stringify(errors) : null,
            },
        });

        return {
            eventId,
            status: finalStatus as any,
            handlersExecuted: handlers.length,
            handlersSucceeded,
            handlersFailed,
            errors,
        };
    }

    /**
     * Get pending events for processing (for worker/queue)
     */
    async getPendingEvents(tenantId?: string, limit = 100): Promise<WorkflowEventData[]> {
        const events = await this.prisma.workflowEvent.findMany({
            where: {
                status: 'PENDING',
                ...(tenantId && { tenantId }),
            },
            include: {
                eventType: {
                    include: { channel: true },
                },
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });

        return events.map((event: any) => ({
            id: event.id,
            tenantId: event.tenantId,
            eventTypeId: event.eventTypeId,
            eventTypeCode: event.eventType.code,
            channelCode: event.eventType.channel.code,
            payload: event.payload as Record<string, unknown>,
            source: event.source,
            actorId: event.actorId,
            actorType: event.actorType as any,
            status: event.status as any,
            correlationId: event.correlationId,
            causationId: event.causationId,
            error: event.error,
            processedAt: event.processedAt,
            createdAt: event.createdAt,
        }));
    }

    /**
     * Get events by correlation ID (for tracing related events)
     */
    async getEventsByCorrelation(
        tenantId: string,
        correlationId: string
    ): Promise<WorkflowEventData[]> {
        const events = await this.prisma.workflowEvent.findMany({
            where: { tenantId, correlationId },
            include: {
                eventType: {
                    include: { channel: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return events.map((event: any) => ({
            id: event.id,
            tenantId: event.tenantId,
            eventTypeId: event.eventTypeId,
            eventTypeCode: event.eventType.code,
            channelCode: event.eventType.channel.code,
            payload: event.payload as Record<string, unknown>,
            source: event.source,
            actorId: event.actorId,
            actorType: event.actorType as any,
            status: event.status as any,
            correlationId: event.correlationId,
            causationId: event.causationId,
            error: event.error,
            processedAt: event.processedAt,
            createdAt: event.createdAt,
        }));
    }

    /**
     * Get event with executions (for debugging/auditing)
     */
    async getEventWithExecutions(tenantId: string, eventId: string) {
        const event = await this.prisma.workflowEvent.findFirst({
            where: { id: eventId, tenantId },
            include: {
                eventType: {
                    include: { channel: true },
                },
                executions: {
                    include: {
                        handler: {
                            select: { id: true, name: true, handlerType: true },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        return event;
    }

    // ==========================================
    // HANDLER EXECUTION
    // ==========================================

    /**
     * Execute a handler based on its type
     */
    private async executeHandler(
        handlerType: string,
        config: HandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        switch (handlerType) {
            case 'INTERNAL':
                return this.executeInternalHandler(config as InternalHandlerConfig, payload, tenantId);
            case 'WEBHOOK':
                return this.executeWebhookHandler(config as WebhookHandlerConfig, payload);
            case 'WORKFLOW':
                return this.executeWorkflowHandler(config as WorkflowHandlerConfig, payload, tenantId);
            case 'NOTIFICATION':
                return this.executeNotificationHandler(
                    config as NotificationHandlerConfig,
                    payload,
                    tenantId
                );
            case 'SCRIPT':
                // TODO: Implement script execution (sandboxed)
                throw new Error('Script handlers not yet implemented');
            default:
                throw new Error(`Unknown handler type: ${handlerType}`);
        }
    }

    /**
     * Execute an internal service method
     */
    private async executeInternalHandler(
        config: InternalHandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        // Get the service from the registry
        const service = this.serviceRegistry.get(config.service);
        if (!service) {
            throw new Error(`Service '${config.service}' not found in registry`);
        }

        // Get the method
        const method = service[config.method];
        if (typeof method !== 'function') {
            throw new Error(`Method '${config.method}' not found on service '${config.service}'`);
        }

        // Transform payload if mapping is defined
        const transformedPayload = config.payloadMapping
            ? this.transformPayload(payload, config.payloadMapping)
            : payload;

        // Call the method with tenantId and payload
        return method.call(service, tenantId, transformedPayload);
    }

    /**
     * Execute a webhook handler
     */
    private async executeWebhookHandler(
        config: WebhookHandlerConfig,
        payload: Record<string, unknown>
    ): Promise<unknown> {
        const transformedPayload = config.payloadMapping
            ? this.transformPayload(payload, config.payloadMapping)
            : payload;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

        try {
            const response = await fetch(config.url, {
                method: config.method,
                headers: {
                    'Content-Type': 'application/json',
                    ...config.headers,
                },
                body: config.method !== 'GET' ? JSON.stringify(transformedPayload) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Webhook returned ${response.status}: ${errorText}`);
            }

            // Try to parse JSON response, fall back to empty object
            try {
                return await response.json();
            } catch {
                return {};
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Execute a workflow handler
     *
     * This emits a new event that the workflow service can pick up,
     * creating loose coupling between event system and workflow engine.
     */
    private async executeWorkflowHandler(
        config: WorkflowHandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        // Return the workflow action data
        // The workflow service should listen for WORKFLOW handler results
        return {
            action: config.action,
            workflowId: config.workflowId,
            phaseId: config.phaseId,
            stepId: config.stepId,
            data: { ...config.data, ...payload },
            tenantId,
        };
    }

    /**
     * Execute a notification handler
     *
     * This would integrate with a notification service.
     * Returns what would be sent for logging purposes.
     */
    private async executeNotificationHandler(
        config: NotificationHandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        // TODO: Integrate with actual notification service
        // For now, return the notification data for logging
        return {
            template: config.template,
            channels: config.channels,
            recipients: this.resolveRecipients(config.recipients, payload),
            priority: config.priority || 'normal',
            data: payload,
            tenantId,
        };
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Evaluate a filter condition against the payload
     */
    private evaluateFilterCondition(
        condition: string,
        payload: Record<string, unknown>
    ): boolean {
        try {
            // Simple JSONPath-like evaluation
            // Supports: $.field == 'value', $.field != 'value', $.field > 10, etc.

            // Equality: $.field == 'value'
            const eqMatch = condition.match(/^\$\.(\w+(?:\.\w+)*)\s*==\s*['"](.+)['"]$/);
            if (eqMatch) {
                const [, path, value] = eqMatch;
                return this.resolvePath(payload, path) === value;
            }

            // Inequality: $.field != 'value'
            const neqMatch = condition.match(/^\$\.(\w+(?:\.\w+)*)\s*!=\s*['"](.+)['"]$/);
            if (neqMatch) {
                const [, path, value] = neqMatch;
                return this.resolvePath(payload, path) !== value;
            }

            // Numeric comparison: $.field > 10
            const numMatch = condition.match(/^\$\.(\w+(?:\.\w+)*)\s*([<>=!]+)\s*(\d+(?:\.\d+)?)$/);
            if (numMatch) {
                const [, path, op, numStr] = numMatch;
                const fieldValue = this.resolvePath(payload, path);
                const num = parseFloat(numStr);

                if (typeof fieldValue !== 'number') return false;

                switch (op) {
                    case '>':
                        return fieldValue > num;
                    case '>=':
                        return fieldValue >= num;
                    case '<':
                        return fieldValue < num;
                    case '<=':
                        return fieldValue <= num;
                    case '==':
                        return fieldValue === num;
                    case '!=':
                        return fieldValue !== num;
                    default:
                        return true;
                }
            }

            // Existence check: $.field (truthy check)
            const existsMatch = condition.match(/^\$\.(\w+(?:\.\w+)*)$/);
            if (existsMatch) {
                const [, path] = existsMatch;
                return !!this.resolvePath(payload, path);
            }

            // If we can't parse, run the handler (fail open)
            return true;
        } catch {
            return true;
        }
    }

    /**
     * Transform payload using a mapping
     */
    private transformPayload(
        payload: Record<string, unknown>,
        mapping: Record<string, string>
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [targetKey, sourcePath] of Object.entries(mapping)) {
            result[targetKey] = this.resolvePath(payload, sourcePath);
        }
        return result;
    }

    /**
     * Resolve a dot-notation path in an object
     */
    private resolvePath(obj: Record<string, unknown>, path: string): unknown {
        const parts = path.replace(/^\$\./, '').split('.');
        let current: unknown = obj;
        for (const part of parts) {
            if (current == null) return undefined;
            current = (current as Record<string, unknown>)[part];
        }
        return current;
    }

    /**
     * Resolve recipients from config, potentially using payload variables
     */
    private resolveRecipients(
        recipients: NotificationHandlerConfig['recipients'],
        payload: Record<string, unknown>
    ): NotificationHandlerConfig['recipients'] {
        if (!recipients) return undefined;

        const resolved: NotificationHandlerConfig['recipients'] = {};

        // Resolve email recipients
        if (recipients.email) {
            resolved.email = recipients.email.map((addr) => {
                if (addr.startsWith('$.')) {
                    const value = this.resolvePath(payload, addr);
                    return typeof value === 'string' ? value : addr;
                }
                return addr;
            });
        }

        // Resolve phone recipients
        if (recipients.phone) {
            resolved.phone = recipients.phone.map((phone) => {
                if (phone.startsWith('$.')) {
                    const value = this.resolvePath(payload, phone);
                    return typeof value === 'string' ? value : phone;
                }
                return phone;
            });
        }

        // Resolve userId recipients
        if (recipients.userId) {
            resolved.userId = recipients.userId.map((id) => {
                if (id.startsWith('$.')) {
                    const value = this.resolvePath(payload, id);
                    return typeof value === 'string' ? value : id;
                }
                return id;
            });
        }

        return resolved;
    }
}

/**
 * Create a workflow event service instance
 */
export function createWorkflowEventService(
    prisma: PrismaClient,
    serviceRegistry?: ServiceRegistry
): WorkflowEventService {
    return new WorkflowEventService(prisma, serviceRegistry);
}
