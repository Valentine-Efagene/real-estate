import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// ============== Schemas ==============

export const CreateEventTypeSchema = z.object({
    channelId: z.string().cuid()
        .openapi({ description: 'The ID of the parent event channel' }),
    code: z.string().min(1).max(100)
        .regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be uppercase with underscores (e.g., DOWNPAYMENT_COMPLETED)')
        .openapi({ description: 'Unique event type code within the channel (uppercase, underscores allowed)' }),
    name: z.string().min(1).max(255)
        .openapi({ description: 'Human-readable event type name' }),
    description: z.string().max(1000).optional()
        .openapi({ description: 'Event type description' }),
}).openapi('CreateEventType');

export const UpdateEventTypeSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional().nullable(),
}).openapi('UpdateEventType');

export const EventTypeResponseSchema = z.object({
    id: z.string().cuid(),
    tenantId: z.string().cuid(),
    channelId: z.string().cuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('EventTypeResponse');

export const EventTypeWithChannelResponseSchema = EventTypeResponseSchema.extend({
    channel: z.object({
        id: z.string().cuid(),
        code: z.string(),
        name: z.string(),
    }).optional(),
}).openapi('EventTypeWithChannelResponse');

export const EventTypeWithHandlersResponseSchema = EventTypeResponseSchema.extend({
    channel: z.object({
        id: z.string().cuid(),
        code: z.string(),
        name: z.string(),
    }).optional(),
    handlers: z.array(z.object({
        id: z.string().cuid(),
        name: z.string(),
        handlerType: z.string(),
        enabled: z.boolean(),
    })).optional(),
}).openapi('EventTypeWithHandlersResponse');

export const EventTypeListResponseSchema = z.array(EventTypeResponseSchema).openapi('EventTypeListResponse');

// ============== Types ==============

export type CreateEventTypeInput = z.infer<typeof CreateEventTypeSchema>;
export type UpdateEventTypeInput = z.infer<typeof UpdateEventTypeSchema>;
export type EventTypeResponse = z.infer<typeof EventTypeResponseSchema>;
