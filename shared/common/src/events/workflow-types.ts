/**
 * Event-Driven Workflow Types
 *
 * These types define the structure for a configurable event system
 * where admins can define event types, channels, and handlers.
 *
 * Architecture:
 * 1. EventChannel - Logical grouping of events (e.g., "CONTRACTS", "PAYMENTS")
 * 2. EventType - Specific event types (e.g., "DOCUMENT_UPLOADED", "STEP_COMPLETED")
 * 3. EventHandler - What to do when an event fires (send email, call webhook, etc.)
 * 4. WorkflowEvent - Actual event instances (audit log)
 * 5. EventHandlerExecution - Log of handler executions
 *
 * Handler types are business-friendly so non-technical admins can configure them:
 * - SEND_EMAIL: Send an email to someone
 * - SEND_SMS: Send a text message
 * - SEND_PUSH: Send a push notification
 * - CALL_WEBHOOK: Call an external API
 * - ADVANCE_WORKFLOW: Move workflow forward
 * - RUN_AUTOMATION: Execute business logic
 */

// Re-export enum types from generated client for convenience
export type {
    EventHandlerType,
    ActorType,
    WorkflowEventStatus,
    ExecutionStatus,
} from '../../generated/client/enums';

// =============================================================================
// HANDLER CONFIGURATION TYPES (Business-Friendly)
// =============================================================================

/**
 * Configuration for SEND_EMAIL handler type
 * Sends an email notification to specified recipients
 */
export interface SendEmailHandlerConfig {
    type: 'SEND_EMAIL';
    /** Email template name (e.g., "documentApproved", "paymentReminder") */
    template: string;
    /**
     * Notification type for the notification service.
     * This maps to templates in the notification service.
     */
    notificationType: string;
    /**
     * Who to send the email to. Use JSONPath to extract from event payload.
     * Examples: "$.buyer.email", "$.user.email"
     */
    recipientPath: string;
    /**
     * Map event payload fields to template variables
     * Example: { "userName": "$.buyer.firstName", "amount": "$.payment.amount" }
     */
    templateData?: Record<string, string>;
    /** Static data to always include in template */
    staticData?: Record<string, unknown>;
    /** Priority level */
    priority?: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Configuration for SEND_SMS handler type
 * Sends an SMS text message
 */
export interface SendSmsHandlerConfig {
    type: 'SEND_SMS';
    /** SMS template name */
    template: string;
    /**
     * Notification type for the notification service.
     */
    notificationType: string;
    /**
     * Phone number path in event payload
     * Example: "$.buyer.phone"
     */
    recipientPath: string;
    /** Map event payload fields to template variables */
    templateData?: Record<string, string>;
    /** Static data to always include in template */
    staticData?: Record<string, unknown>;
}

/**
 * Configuration for SEND_PUSH handler type
 * Sends a push notification to user's device
 */
export interface SendPushHandlerConfig {
    type: 'SEND_PUSH';
    /** Push notification title */
    title: string;
    /** Push notification body (can use {{variables}}) */
    body: string;
    /**
     * Notification type for the notification service.
     */
    notificationType: string;
    /**
     * User ID path in event payload (to find their device)
     * Example: "$.buyer.id"
     */
    recipientPath: string;
    /** Deep link to open in app */
    deepLink?: string;
    /** Map event payload fields to notification variables */
    templateData?: Record<string, string>;
    /** Static data to always include in notification */
    staticData?: Record<string, unknown>;
}

/**
 * Configuration for CALL_WEBHOOK handler type
 * Calls an external API endpoint
 */
export interface CallWebhookHandlerConfig {
    type: 'CALL_WEBHOOK';
    /** The URL to call */
    url: string;
    /** HTTP method */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Optional headers to include */
    headers?: Record<string, string>;
    /**
     * Map event payload fields to request body
     * Example: { "orderId": "$.contract.id", "status": "$.status" }
     */
    bodyMapping?: Record<string, string>;
    /** Timeout in milliseconds (default: 30000) */
    timeoutMs?: number;
}

/**
 * Configuration for ADVANCE_WORKFLOW handler type
 * Advances or modifies a workflow step
 */
export interface AdvanceWorkflowHandlerConfig {
    type: 'ADVANCE_WORKFLOW';
    /** What action to take */
    action: 'complete_step' | 'skip_step' | 'fail_step' | 'activate_phase';
    /**
     * Step ID path in event payload (if action targets a specific step)
     * Example: "$.stepId"
     */
    stepIdPath?: string;
    /**
     * Phase ID path in event payload (if action targets a phase)
     * Example: "$.phaseId"
     */
    phaseIdPath?: string;
    /** Static step ID (if not using path) */
    stepId?: string;
    /** Static workflow ID */
    workflowId?: string;
    /** Static phase ID */
    phaseId?: string;
    /** Additional data to pass to the action */
    data?: Record<string, unknown>;
    /** Reason to record for the action */
    reason?: string;
}

/**
 * Configuration for RUN_AUTOMATION handler type
 * Executes internal business logic
 */
export interface RunAutomationHandlerConfig {
    type: 'RUN_AUTOMATION';
    /** The automation to run (registered automation name) */
    automation: string;
    /**
     * Map event payload fields to automation inputs
     * Example: { "contractId": "$.contract.id", "amount": "$.payment.amount" }
     */
    inputMapping?: Record<string, string>;
}

/**
 * Union type for all handler configurations
 */
export type HandlerConfig =
    | SendEmailHandlerConfig
    | SendSmsHandlerConfig
    | SendPushHandlerConfig
    | CallWebhookHandlerConfig
    | AdvanceWorkflowHandlerConfig
    | RunAutomationHandlerConfig;

// =============================================================================
// EVENT EMISSION TYPES
// =============================================================================

/**
 * Input for emitting an event
 */
export interface EmitEventInput {
    /** Event type code (e.g., "DOCUMENT_UPLOADED") */
    eventType: string;
    /** Event payload */
    payload: Record<string, unknown>;
    /** Source of the event (service name) */
    source: string;
    /** Actor information */
    actor?: {
        id: string;
        type: 'USER' | 'API_KEY' | 'SYSTEM' | 'WEBHOOK';
    };
    /** Correlation ID for tracing related events */
    correlationId?: string;
    /** Causation ID (which event caused this one) */
    causationId?: string;
}

/**
 * Event with full metadata (returned from queries)
 */
export interface WorkflowEventData {
    id: string;
    tenantId: string;
    eventTypeId: string;
    eventTypeCode: string;
    channelCode: string;
    payload: Record<string, unknown>;
    source: string;
    actorId: string | null;
    actorType: 'USER' | 'API_KEY' | 'SYSTEM' | 'WEBHOOK';
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    correlationId: string | null;
    causationId: string | null;
    error: string | null;
    processedAt: Date | null;
    createdAt: Date;
}

/**
 * Result of processing an event
 */
export interface ProcessEventResult {
    eventId: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
    handlersExecuted: number;
    handlersSucceeded: number;
    handlersFailed: number;
    errors: Array<{
        handlerId: string;
        handlerName: string;
        error: string;
    }>;
}

// =============================================================================
// ADMIN CONFIGURATION TYPES
// =============================================================================

/**
 * Input for creating an event channel
 */
export interface CreateEventChannelInput {
    code: string;
    name: string;
    description?: string;
    enabled?: boolean;
}

/**
 * Input for updating an event channel
 */
export interface UpdateEventChannelInput {
    name?: string;
    description?: string;
    enabled?: boolean;
}

/**
 * Input for creating an event type
 */
export interface CreateEventTypeInput {
    channelId: string;
    code: string;
    name: string;
    description?: string;
    payloadSchema?: Record<string, unknown>;
    enabled?: boolean;
}

/**
 * Input for updating an event type
 */
export interface UpdateEventTypeInput {
    name?: string;
    description?: string;
    payloadSchema?: Record<string, unknown>;
    enabled?: boolean;
}

/**
 * Input for creating an event handler
 *
 * Handler types are business-friendly names:
 * - SEND_EMAIL: Send email notification
 * - SEND_SMS: Send SMS text message
 * - SEND_PUSH: Send push notification
 * - CALL_WEBHOOK: Call external API
 * - ADVANCE_WORKFLOW: Move workflow forward
 * - RUN_AUTOMATION: Execute business logic
 */
export interface CreateEventHandlerInput {
    eventTypeId: string;
    name: string;
    description?: string;
    handlerType: 'SEND_EMAIL' | 'SEND_SMS' | 'SEND_PUSH' | 'CALL_WEBHOOK' | 'ADVANCE_WORKFLOW' | 'RUN_AUTOMATION';
    config: HandlerConfig;
    priority?: number;
    enabled?: boolean;
    maxRetries?: number;
    retryDelayMs?: number;
    filterCondition?: string;
}

/**
 * Input for updating an event handler
 */
export interface UpdateEventHandlerInput {
    name?: string;
    description?: string;
    config?: HandlerConfig;
    priority?: number;
    enabled?: boolean;
    maxRetries?: number;
    retryDelayMs?: number;
    filterCondition?: string;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Event channel with related data
 */
export interface EventChannelWithTypes {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description: string | null;
    enabled: boolean;
    eventTypes: Array<{
        id: string;
        code: string;
        name: string;
        enabled: boolean;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Event type with related data
 */
export interface EventTypeWithHandlers {
    id: string;
    tenantId: string;
    channelId: string;
    channel: {
        code: string;
        name: string;
    };
    code: string;
    name: string;
    description: string | null;
    payloadSchema: Record<string, unknown> | null;
    enabled: boolean;
    handlers: Array<{
        id: string;
        name: string;
        handlerType: string;
        enabled: boolean;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Event handler with related data
 */
export interface EventHandlerWithType {
    id: string;
    tenantId: string;
    eventTypeId: string;
    eventType: {
        code: string;
        name: string;
        channel: {
            code: string;
            name: string;
        };
    };
    name: string;
    description: string | null;
    handlerType: string;
    config: HandlerConfig;
    priority: number;
    enabled: boolean;
    maxRetries: number;
    retryDelayMs: number;
    filterCondition: string | null;
    createdAt: Date;
    updatedAt: Date;
}
