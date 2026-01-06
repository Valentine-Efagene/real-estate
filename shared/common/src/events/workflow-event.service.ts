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
    SendEmailHandlerConfig,
    SendSmsHandlerConfig,
    SendPushHandlerConfig,
    CallWebhookHandlerConfig,
    AdvanceWorkflowHandlerConfig,
    RunAutomationHandlerConfig,
} from './workflow-types';
import { EventPublisher } from './event-publisher';
import { NotificationType, NotificationChannel } from './notification-enums';

/**
 * Automation registry interface for RUN_AUTOMATION handlers
 */
export interface AutomationRegistry {
    get(automationName: string): ((inputs: Record<string, unknown>, tenantId: string) => Promise<unknown>) | undefined;
    register(automationName: string, handler: (inputs: Record<string, unknown>, tenantId: string) => Promise<unknown>): void;
}

/**
 * Simple in-memory automation registry
 */
class InMemoryAutomationRegistry implements AutomationRegistry {
    private automations = new Map<string, (inputs: Record<string, unknown>, tenantId: string) => Promise<unknown>>();

    get(automationName: string) {
        return this.automations.get(automationName);
    }

    register(automationName: string, handler: (inputs: Record<string, unknown>, tenantId: string) => Promise<unknown>): void {
        this.automations.set(automationName, handler);
    }
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

/**
 * Service registry interface for internal handlers (legacy support)
 */
export interface ServiceRegistry {
    get(serviceName: string): any | undefined;
    register(serviceName: string, service: any): void;
}

export class WorkflowEventService {
    private automationRegistry: AutomationRegistry;
    private eventPublisher: EventPublisher;

    constructor(
        private prisma: PrismaClient,
        automationRegistry?: AutomationRegistry,
        eventPublisher?: EventPublisher
    ) {
        this.automationRegistry = automationRegistry || new InMemoryAutomationRegistry();
        this.eventPublisher = eventPublisher || new EventPublisher('workflow-event-service');
    }

    /**
     * Register an automation for RUN_AUTOMATION handlers
     *
     * Automations are business logic functions that can be triggered by events.
     * Example: "calculateLateFee", "sendWelcomePackage", "archiveContract"
     */
    registerAutomation(
        name: string,
        handler: (inputs: Record<string, unknown>, tenantId: string) => Promise<unknown>
    ): void {
        this.automationRegistry.register(name, handler);
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
     *
     * Handler types are business-friendly names that abstract the underlying implementation:
     * - SEND_EMAIL: Send email via notification service (SNS → SQS → SES)
     * - SEND_SMS: Send SMS via notification service
     * - SEND_PUSH: Send push notification via notification service
     * - CALL_WEBHOOK: Make HTTP request to external URL
     * - ADVANCE_WORKFLOW: Move workflow steps forward/backward
     * - RUN_AUTOMATION: Execute registered business logic automation
     */
    private async executeHandler(
        handlerType: string,
        config: HandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        switch (handlerType) {
            case 'SEND_EMAIL':
                return this.executeSendEmailHandler(config as SendEmailHandlerConfig, payload, tenantId);
            case 'SEND_SMS':
                return this.executeSendSmsHandler(config as SendSmsHandlerConfig, payload, tenantId);
            case 'SEND_PUSH':
                return this.executeSendPushHandler(config as SendPushHandlerConfig, payload, tenantId);
            case 'CALL_WEBHOOK':
                return this.executeCallWebhookHandler(config as CallWebhookHandlerConfig, payload);
            case 'ADVANCE_WORKFLOW':
                return this.executeAdvanceWorkflowHandler(
                    config as AdvanceWorkflowHandlerConfig,
                    payload,
                    tenantId
                );
            case 'RUN_AUTOMATION':
                return this.executeRunAutomationHandler(
                    config as RunAutomationHandlerConfig,
                    payload,
                    tenantId
                );
            default:
                throw new Error(`Unknown handler type: ${handlerType}`);
        }
    }

    /**
     * Execute SEND_EMAIL handler
     *
     * Sends an email via the notification service using SNS → SQS → SES.
     * Business users configure: template, recipient, and template data.
     */
    private async executeSendEmailHandler(
        config: SendEmailHandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        // Build the notification payload
        const notificationPayload = this.buildNotificationPayload(config, payload);

        // Resolve recipient email from the payload
        if (config.recipientPath) {
            const email = this.resolvePath(payload, config.recipientPath.replace(/^\$\./, ''));
            if (email && typeof email === 'string') {
                notificationPayload.to_email = email;
            }
        }

        // Publish to SNS via EventPublisher
        const messageId = await this.eventPublisher.publish(
            config.notificationType as NotificationType,
            NotificationChannel.EMAIL,
            notificationPayload,
            {
                tenantId,
                correlationId: (payload.correlationId as string) || undefined,
                userId: (payload.userId as string) || (payload.actorId as string) || undefined,
            }
        );

        return {
            success: true,
            messageId,
            notificationType: config.notificationType,
            channel: 'email',
            payload: notificationPayload,
            tenantId,
        };
    }

    /**
     * Execute SEND_SMS handler
     *
     * Sends an SMS via the notification service.
     * Business users configure: template, recipient phone, and template data.
     */
    private async executeSendSmsHandler(
        config: SendSmsHandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        // Build the notification payload
        const notificationPayload = this.buildNotificationPayload(config, payload);

        // Resolve recipient phone from the payload
        if (config.recipientPath) {
            const phone = this.resolvePath(payload, config.recipientPath.replace(/^\$\./, ''));
            if (phone && typeof phone === 'string') {
                notificationPayload.to_phone = phone;
            }
        }

        // Publish to SNS via EventPublisher
        const messageId = await this.eventPublisher.publish(
            config.notificationType as NotificationType,
            NotificationChannel.SMS,
            notificationPayload,
            {
                tenantId,
                correlationId: (payload.correlationId as string) || undefined,
                userId: (payload.userId as string) || (payload.actorId as string) || undefined,
            }
        );

        return {
            success: true,
            messageId,
            notificationType: config.notificationType,
            channel: 'sms',
            payload: notificationPayload,
            tenantId,
        };
    }

    /**
     * Execute SEND_PUSH handler
     *
     * Sends a push notification via the notification service.
     * Business users configure: template, recipient user, and template data.
     */
    private async executeSendPushHandler(
        config: SendPushHandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        // Build the notification payload
        const notificationPayload = this.buildNotificationPayload(config, payload);

        // Resolve recipient user ID from the payload
        if (config.recipientPath) {
            const userId = this.resolvePath(payload, config.recipientPath.replace(/^\$\./, ''));
            if (userId && typeof userId === 'string') {
                notificationPayload.to_user_id = userId;
            }
        }

        // Publish to SNS via EventPublisher
        const messageId = await this.eventPublisher.publish(
            config.notificationType as NotificationType,
            NotificationChannel.PUSH,
            notificationPayload,
            {
                tenantId,
                correlationId: (payload.correlationId as string) || undefined,
                userId: (payload.userId as string) || (payload.actorId as string) || undefined,
            }
        );

        return {
            success: true,
            messageId,
            notificationType: config.notificationType,
            channel: 'push',
            payload: notificationPayload,
            tenantId,
        };
    }

    /**
     * Build notification payload from config and event payload
     */
    private buildNotificationPayload(
        config: SendEmailHandlerConfig | SendSmsHandlerConfig | SendPushHandlerConfig,
        payload: Record<string, unknown>
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        // Apply static template data first
        if (config.staticData) {
            Object.assign(result, config.staticData);
        }

        // Apply template data mapping (map from event payload to notification payload)
        if (config.templateData) {
            for (const [targetField, sourcePath] of Object.entries(config.templateData)) {
                const value = this.resolvePath(payload, sourcePath.replace(/^\$\./, ''));
                if (value !== undefined) {
                    result[targetField] = value;
                }
            }
        }

        return result;
    }

    /**
     * Execute CALL_WEBHOOK handler
     *
     * Makes an HTTP request to an external URL.
     * Business users configure: URL, method, headers, and body mapping.
     */
    private async executeCallWebhookHandler(
        config: CallWebhookHandlerConfig,
        payload: Record<string, unknown>
    ): Promise<unknown> {
        const transformedPayload = config.bodyMapping
            ? this.transformPayload(payload, config.bodyMapping)
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
     * Execute ADVANCE_WORKFLOW handler
     *
     * Advances or modifies workflow state.
     * Business users configure: action (approve/reject/skip), step path, and data.
     */
    private async executeAdvanceWorkflowHandler(
        config: AdvanceWorkflowHandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        // Resolve step ID from payload if path is provided
        let stepId = config.stepId;
        if (config.stepIdPath) {
            const resolved = this.resolvePath(payload, config.stepIdPath.replace(/^\$\./, ''));
            if (resolved && typeof resolved === 'string') {
                stepId = resolved;
            }
        }

        // Return the workflow action data
        // The workflow service should listen for ADVANCE_WORKFLOW handler results
        return {
            action: config.action,
            workflowId: config.workflowId,
            phaseId: config.phaseId,
            stepId,
            data: { ...config.data, ...payload },
            tenantId,
        };
    }

    /**
     * Execute RUN_AUTOMATION handler
     *
     * Runs a registered business logic automation.
     * Business users select from pre-defined automations like
     * "Calculate Mortgage Payment", "Generate Contract", etc.
     */
    private async executeRunAutomationHandler(
        config: RunAutomationHandlerConfig,
        payload: Record<string, unknown>,
        tenantId: string
    ): Promise<unknown> {
        // Get the automation function from the registry
        const automationFn = this.automationRegistry.get(config.automation);
        if (!automationFn) {
            throw new Error(`Automation '${config.automation}' not found in registry`);
        }

        // Transform payload if mapping is defined
        const transformedPayload = config.inputMapping
            ? this.transformPayload(payload, config.inputMapping)
            : payload;

        // Call the automation function with inputs and tenantId
        return automationFn(transformedPayload, tenantId);
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
}

/**
 * Create a workflow event service instance
 *
 * @param prisma - Prisma client for database access
 * @param automationRegistry - Optional registry of business automations
 */
export function createWorkflowEventService(
    prisma: PrismaClient,
    automationRegistry?: AutomationRegistry
): WorkflowEventService {
    return new WorkflowEventService(prisma, automationRegistry);
}
