import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// ============== Schemas ==============

export const CreateEventChannelSchema = z.object({
    code: z.string().min(1).max(100)
        .regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be uppercase with underscores (e.g., MORTGAGE_OPS)')
        .openapi({ description: 'Unique channel code (uppercase, underscores allowed)' }),
    name: z.string().min(1).max(255)
        .openapi({ description: 'Human-readable channel name' }),
    description: z.string().max(1000).optional()
        .openapi({ description: 'Channel description' }),
}).openapi('CreateEventChannel');

export const UpdateEventChannelSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional().nullable(),
}).openapi('UpdateEventChannel');

export const EventChannelResponseSchema = z.object({
    id: z.string().cuid(),
    tenantId: z.string().cuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('EventChannelResponse');

export const EventChannelWithTypesResponseSchema = EventChannelResponseSchema.extend({
    eventTypes: z.array(z.object({
        id: z.string().cuid(),
        code: z.string(),
        name: z.string(),
        description: z.string().nullable(),
    })).optional(),
}).openapi('EventChannelWithTypesResponse');

export const EventChannelListResponseSchema = z.array(EventChannelResponseSchema).openapi('EventChannelListResponse');

// ============== Types ==============

export type CreateEventChannelInput = z.infer<typeof CreateEventChannelSchema>;
export type UpdateEventChannelInput = z.infer<typeof UpdateEventChannelSchema>;
export type EventChannelResponse = z.infer<typeof EventChannelResponseSchema>;
