import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// =============================================================================
// ENUMS
// =============================================================================

export const EventHandlerTypeEnum = z.enum([
    'SEND_EMAIL',
    'SEND_SMS',
    'SEND_PUSH',
    'CALL_WEBHOOK',
    'ADVANCE_WORKFLOW',
    'RUN_AUTOMATION',
]);

export const StepTriggerEnum = z.enum([
    'ON_COMPLETE',
    'ON_REJECT',
    'ON_SUBMIT',
    'ON_RESUBMIT',
    'ON_START',
]);

// =============================================================================
// HANDLER CONFIG SCHEMAS (Business-Friendly)
// =============================================================================

/**
 * Send Email Handler Configuration
 */
export const SendEmailConfigSchema = z.object({
    type: z.literal('SEND_EMAIL'),
    template: z.string().min(1).openapi({ example: 'documentApproved', description: 'Email template name' }),
    notificationType: z.string().min(1).openapi({ example: 'DOCUMENT_APPROVED', description: 'Notification type for the notification service' }),
    recipientPath: z.string().min(1).openapi({ example: '$.buyer.email', description: 'JSONPath to recipient email in event payload' }),
    templateData: z.record(z.string(), z.string()).optional().openapi({
        example: { userName: '$.buyer.firstName', amount: '$.payment.amount' },
        description: 'Map payload fields to template variables using JSONPath',
    }),
    staticData: z.record(z.string(), z.unknown()).optional().openapi({ description: 'Static data always included in template' }),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
}).openapi('SendEmailConfig');

/**
 * Send SMS Handler Configuration
 */
export const SendSmsConfigSchema = z.object({
    type: z.literal('SEND_SMS'),
    template: z.string().min(1).openapi({ example: 'paymentReminder', description: 'SMS template name' }),
    notificationType: z.string().min(1).openapi({ example: 'PAYMENT_REMINDER' }),
    recipientPath: z.string().min(1).openapi({ example: '$.buyer.phone', description: 'JSONPath to phone number in event payload' }),
    templateData: z.record(z.string(), z.string()).optional(),
    staticData: z.record(z.string(), z.unknown()).optional(),
}).openapi('SendSmsConfig');

/**
 * Send Push Notification Handler Configuration
 */
export const SendPushConfigSchema = z.object({
    type: z.literal('SEND_PUSH'),
    title: z.string().min(1).openapi({ example: 'Document Approved!' }),
    body: z.string().min(1).openapi({ example: 'Your {{documentType}} has been approved.' }),
    notificationType: z.string().min(1).openapi({ example: 'DOCUMENT_APPROVED' }),
    recipientPath: z.string().min(1).openapi({ example: '$.buyer.id', description: 'JSONPath to user ID (to find their device)' }),
    deepLink: z.string().optional().openapi({ example: 'qshelter://contracts/{{contractId}}' }),
    templateData: z.record(z.string(), z.string()).optional(),
    staticData: z.record(z.string(), z.unknown()).optional(),
}).openapi('SendPushConfig');

/**
 * Call Webhook Handler Configuration
 * Use this for integrating with external APIs (credit score, KYC providers, etc.)
 */
export const CallWebhookConfigSchema = z.object({
    type: z.literal('CALL_WEBHOOK'),
    url: z.string().url().openapi({ example: 'https://api.creditbureau.com/v1/score', description: 'The URL to call' }),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST').openapi({ example: 'POST' }),
    headers: z.record(z.string(), z.string()).optional().openapi({
        example: { 'Authorization': 'Bearer {{secret:credit_api_key}}', 'Content-Type': 'application/json' },
        description: 'Headers to include. Use {{secret:key}} for secrets.',
    }),
    bodyMapping: z.record(z.string(), z.string()).optional().openapi({
        example: { customerId: '$.buyer.id', ssn: '$.buyer.ssn' },
        description: 'Map event payload fields to request body using JSONPath',
    }),
    timeoutMs: z.number().int().min(1000).max(60000).optional().default(30000).openapi({ example: 30000 }),
}).openapi('CallWebhookConfig');

/**
 * Advance Workflow Handler Configuration
 * Use this to automatically move workflows forward based on events
 */
export const AdvanceWorkflowConfigSchema = z.object({
    type: z.literal('ADVANCE_WORKFLOW'),
    action: z.enum(['complete_step', 'skip_step', 'fail_step', 'activate_phase']).openapi({ example: 'complete_step' }),
    stepIdPath: z.string().optional().openapi({ example: '$.stepId', description: 'JSONPath to step ID in payload' }),
    phaseIdPath: z.string().optional().openapi({ example: '$.phaseId', description: 'JSONPath to phase ID in payload' }),
    stepId: z.string().optional().openapi({ description: 'Static step ID (if not using path)' }),
    workflowId: z.string().optional(),
    phaseId: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().optional().openapi({ example: 'Auto-completed by external credit check' }),
}).openapi('AdvanceWorkflowConfig');

/**
 * Run Automation Handler Configuration
 * Use this to trigger internal business logic (calculations, validations, etc.)
 */
export const RunAutomationConfigSchema = z.object({
    type: z.literal('RUN_AUTOMATION'),
    automation: z.string().min(1).openapi({
        example: 'calculateDTI',
        description: 'The registered automation name to run',
    }),
    inputMapping: z.record(z.string(), z.string()).optional().openapi({
        example: { contractId: '$.contract.id', income: '$.buyer.income' },
        description: 'Map event payload fields to automation inputs',
    }),
}).openapi('RunAutomationConfig');

/**
 * Union of all handler configurations
 */
export const HandlerConfigSchema = z.discriminatedUnion('type', [
    SendEmailConfigSchema,
    SendSmsConfigSchema,
    SendPushConfigSchema,
    CallWebhookConfigSchema,
    AdvanceWorkflowConfigSchema,
    RunAutomationConfigSchema,
]).openapi('HandlerConfig');

// =============================================================================
// EVENT CHANNEL SCHEMAS
// =============================================================================

export const CreateEventChannelSchema = z.object({
    code: z.string().min(1).max(50).regex(/^[A-Z_]+$/).openapi({
        example: 'WORKFLOW',
        description: 'Unique code for the channel (UPPER_CASE)',
    }),
    name: z.string().min(1).max(100).openapi({ example: 'Workflow Events' }),
    description: z.string().optional().openapi({ example: 'Events related to workflow step transitions' }),
}).openapi('CreateEventChannel');

export const UpdateEventChannelSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
}).openapi('UpdateEventChannel');

// =============================================================================
// EVENT TYPE SCHEMAS
// =============================================================================

export const CreateEventTypeSchema = z.object({
    channelId: z.string().openapi({ description: 'The channel this event type belongs to' }),
    code: z.string().min(1).max(50).regex(/^[A-Z_]+$/).openapi({
        example: 'STEP_COMPLETED',
        description: 'Unique code for the event type (UPPER_CASE)',
    }),
    name: z.string().min(1).max(100).openapi({ example: 'Step Completed' }),
    description: z.string().optional().openapi({ example: 'Fired when a workflow step is completed' }),
    payloadSchema: z.record(z.string(), z.unknown()).optional().openapi({
        description: 'JSON schema for validating event payloads',
    }),
}).openapi('CreateEventType');

export const UpdateEventTypeSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    payloadSchema: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
}).openapi('UpdateEventType');

// =============================================================================
// EVENT HANDLER SCHEMAS
// =============================================================================

export const CreateEventHandlerSchema = z.object({
    eventTypeId: z.string().openapi({ description: 'The event type this handler responds to' }),
    name: z.string().min(1).max(100).openapi({ example: 'Send Document Approved Email' }),
    description: z.string().optional().openapi({ example: 'Sends an email when a document is approved' }),
    handlerType: EventHandlerTypeEnum.openapi({ example: 'SEND_EMAIL' }),
    config: HandlerConfigSchema.openapi({ description: 'Handler-specific configuration' }),
    priority: z.number().int().min(0).max(1000).optional().default(100).openapi({
        example: 100,
        description: 'Execution order (lower = first)',
    }),
    enabled: z.boolean().optional().default(true),
    maxRetries: z.number().int().min(0).max(10).optional().default(3),
    retryDelayMs: z.number().int().min(100).max(60000).optional().default(1000),
    filterCondition: z.string().optional().openapi({
        example: "$.payload.status == 'approved'",
        description: 'JSONPath expression to conditionally run this handler',
    }),
}).openapi('CreateEventHandler');

export const UpdateEventHandlerSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    handlerType: EventHandlerTypeEnum.optional(),
    config: HandlerConfigSchema.optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
    maxRetries: z.number().int().min(0).max(10).optional(),
    retryDelayMs: z.number().int().min(100).max(60000).optional(),
    filterCondition: z.string().optional(),
}).openapi('UpdateEventHandler');

// =============================================================================
// STEP EVENT ATTACHMENT SCHEMAS
// =============================================================================

export const AttachHandlerToStepSchema = z.object({
    handlerId: z.string().openapi({ description: 'The handler to attach' }),
    trigger: StepTriggerEnum.openapi({ example: 'ON_COMPLETE', description: 'When this handler should fire' }),
    priority: z.number().int().min(0).max(1000).optional().default(100),
    enabled: z.boolean().optional().default(true),
}).openapi('AttachHandlerToStep');

export const UpdateStepAttachmentSchema = z.object({
    priority: z.number().int().min(0).max(1000).optional(),
    enabled: z.boolean().optional(),
}).openapi('UpdateStepAttachment');

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateEventChannelInput = z.infer<typeof CreateEventChannelSchema>;
export type UpdateEventChannelInput = z.infer<typeof UpdateEventChannelSchema>;
export type CreateEventTypeInput = z.infer<typeof CreateEventTypeSchema>;
export type UpdateEventTypeInput = z.infer<typeof UpdateEventTypeSchema>;
export type CreateEventHandlerInput = z.infer<typeof CreateEventHandlerSchema>;
export type UpdateEventHandlerInput = z.infer<typeof UpdateEventHandlerSchema>;
export type AttachHandlerToStepInput = z.infer<typeof AttachHandlerToStepSchema>;
export type UpdateStepAttachmentInput = z.infer<typeof UpdateStepAttachmentSchema>;
export type HandlerConfigInput = z.infer<typeof HandlerConfigSchema>;
