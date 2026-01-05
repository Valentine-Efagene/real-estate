/**
 * Event-Driven Workflow Types
 *
 * These types define the structure for a configurable event system
 * where admins can define event types, channels, and handlers.
 *
 * Architecture:
 * 1. EventChannel - Logical grouping of events (e.g., "CONTRACTS", "PAYMENTS")
 * 2. EventType - Specific event types (e.g., "DOCUMENT_UPLOADED", "STEP_COMPLETED")
 * 3. EventHandler - What to do when an event fires (webhook, internal call, etc.)
 * 4. WorkflowEvent - Actual event instances (audit log)
 * 5. EventHandlerExecution - Log of handler executions
 */

// Re-export enum types from generated client for convenience
export type {
    EventHandlerType,
    ActorType,
    WorkflowEventStatus,
    ExecutionStatus,
} from '../../generated/client/enums';

// =============================================================================
// HANDLER CONFIGURATION TYPES
// =============================================================================

/**
 * Configuration for INTERNAL handler type
 * Calls an internal service method
 */
export interface InternalHandlerConfig {
    type: 'INTERNAL';
    /** Service name (e.g., "contract", "payment") */
    service: string;
    /** Method to call on the service */
    method: string;
    /** Optional payload transformation (JSONPath mapping) */
    payloadMapping?: Record<string, string>;
}

/**
 * Configuration for WEBHOOK handler type
 * Sends HTTP request to external URL
 */
export interface WebhookHandlerConfig {
    type: 'WEBHOOK';
    /** Target URL */
    url: string;
    /** HTTP method */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Optional headers */
    headers?: Record<string, string>;
    /** Optional payload transformation */
    payloadMapping?: Record<string, string>;
    /** Timeout in milliseconds */
    timeoutMs?: number;
    /** Whether to include event metadata in request */
    includeMetadata?: boolean;
}

/**
 * Configuration for WORKFLOW handler type
 * Triggers or advances a workflow
 */
export interface WorkflowHandlerConfig {
    type: 'WORKFLOW';
    /** Target workflow/phase ID */
    workflowId?: string;
    phaseId?: string;
    stepId?: string;
    /** Action to perform */
    action: 'start' | 'advance' | 'complete' | 'fail' | 'skip';
    /** Optional data to pass */
    data?: Record<string, unknown>;
}

/**
 * Configuration for NOTIFICATION handler type
 * Sends notifications via various channels (internal handling)
 */
export interface NotificationHandlerConfig {
    type: 'NOTIFICATION';
    /** Notification template ID or inline template */
    template: string;
    /** Channels to send through */
    channels: ('email' | 'sms' | 'push' | 'in_app')[];
    /** Recipients (can use payload variables like $.user.email) */
    recipients?: {
        email?: string[];
        phone?: string[];
        userId?: string[];
    };
    /** Priority */
    priority?: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Configuration for SNS handler type
 * Publishes to SNS topic, which triggers the notification-service via SQS
 * Uses the NotificationEvent format expected by notification-service
 */
export interface SnsHandlerConfig {
    type: 'SNS';
    /** SNS Topic ARN (optional - defaults to notifications topic) */
    topicArn?: string;
    /** Notification type (from NotificationType enum) */
    notificationType: string;
    /** Notification channel (email, sms, push) */
    channel: 'email' | 'sms' | 'push';
    /**
     * Payload mapping - maps event payload to notification payload
     * Uses JSONPath-like expressions (e.g., $.user.email -> to_email)
     */
    payloadMapping?: Record<string, string>;
    /**
     * Static payload fields to merge with mapped payload
     */
    staticPayload?: Record<string, unknown>;
    /**
     * Email recipient field path in the event payload (e.g., $.user.email)
     */
    recipientPath?: string;
}

/**
 * Configuration for SCRIPT handler type
 * Executes custom logic
 */
export interface ScriptHandlerConfig {
    type: 'SCRIPT';
    /** Script language */
    language: 'jsonata' | 'javascript';
    /** The script/expression to execute */
    script: string;
    /** Timeout in milliseconds */
    timeoutMs?: number;
}

/**
 * Union type for all handler configurations
 */
export type HandlerConfig =
    | InternalHandlerConfig
    | WebhookHandlerConfig
    | WorkflowHandlerConfig
    | NotificationHandlerConfig
    | SnsHandlerConfig
    | ScriptHandlerConfig;

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
 */
export interface CreateEventHandlerInput {
    eventTypeId: string;
    name: string;
    description?: string;
    handlerType: 'INTERNAL' | 'WEBHOOK' | 'WORKFLOW' | 'NOTIFICATION' | 'SCRIPT';
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
