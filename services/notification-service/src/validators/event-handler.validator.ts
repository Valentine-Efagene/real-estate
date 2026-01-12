import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// ============== Enums ==============

export const EventHandlerTypeSchema = z.enum([
    'SEND_EMAIL',
    'SEND_SMS',
    'SEND_PUSH',
    'CALL_WEBHOOK',
    'ADVANCE_WORKFLOW',
    'RUN_AUTOMATION',
]).openapi('EventHandlerType');

// ============== Schemas ==============

export const EventHandlerConfigSchema = z.object({
    template: z.string().optional(),
    recipients: z.array(z.string()).optional(),
    subject: z.string().optional(),
    url: z.string().url().optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    workflowId: z.string().optional(),
    action: z.string().optional(),
    service: z.string().optional(),
}).passthrough().openapi('EventHandlerConfig');

export const CreateEventHandlerSchema = z.object({
    eventTypeId: z.string().cuid(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    handlerType: EventHandlerTypeSchema,
    config: EventHandlerConfigSchema,
    priority: z.number().int().min(0).max(1000).default(100),
    enabled: z.boolean().default(true),
    maxRetries: z.number().int().min(0).max(10).default(3),
    retryDelayMs: z.number().int().min(100).max(60000).default(1000),
    filterCondition: z.string().optional(),
}).openapi('CreateEventHandler');

export const UpdateEventHandlerSchema = CreateEventHandlerSchema.partial().openapi('UpdateEventHandler');

export const EventHandlerResponseSchema = z.object({
    id: z.string().cuid(),
    tenantId: z.string().cuid(),
    eventTypeId: z.string().cuid(),
    name: z.string(),
    description: z.string().nullable(),
    handlerType: EventHandlerTypeSchema,
    config: EventHandlerConfigSchema,
    priority: z.number(),
    enabled: z.boolean(),
    maxRetries: z.number(),
    retryDelayMs: z.number(),
    filterCondition: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('EventHandlerResponse');

export const EventHandlerListResponseSchema = z.array(EventHandlerResponseSchema).openapi('EventHandlerListResponse');

// ============== Types ==============

export type CreateEventHandlerInput = z.infer<typeof CreateEventHandlerSchema>;
export type UpdateEventHandlerInput = z.infer<typeof UpdateEventHandlerSchema>;
export type EventHandlerResponse = z.infer<typeof EventHandlerResponseSchema>;
