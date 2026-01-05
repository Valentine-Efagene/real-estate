/**
 * Event Configuration Service
 *
 * Allows admins to configure event channels, types, and handlers.
 * This is the "admin" side of the event system.
 *
 * Usage:
 * ```typescript
 * const configService = new EventConfigService(prisma);
 *
 * // Create a channel
 * const channel = await configService.createChannel(tenantId, {
 *   code: 'CONTRACTS',
 *   name: 'Contract Events',
 *   description: 'Events related to contract lifecycle',
 * });
 *
 * // Create an event type
 * const eventType = await configService.createEventType(tenantId, {
 *   channelId: channel.id,
 *   code: 'DOCUMENT_UPLOADED',
 *   name: 'Document Uploaded',
 *   description: 'Fired when a document is uploaded to a contract step',
 * });
 *
 * // Create a webhook handler
 * await configService.createHandler(tenantId, {
 *   eventTypeId: eventType.id,
 *   name: 'Notify CRM',
 *   handlerType: 'WEBHOOK',
 *   config: {
 *     type: 'WEBHOOK',
 *     url: 'https://crm.example.com/webhook',
 *     method: 'POST',
 *   },
 * });
 * ```
 */

import { PrismaClient } from '../../generated/client/client';
import type {
    CreateEventChannelInput,
    UpdateEventChannelInput,
    CreateEventTypeInput,
    UpdateEventTypeInput,
    CreateEventHandlerInput,
    UpdateEventHandlerInput,
    EventChannelWithTypes,
    EventTypeWithHandlers,
    EventHandlerWithType,
    HandlerConfig,
} from './workflow-types';

export class EventConfigService {
    constructor(private prisma: PrismaClient) { }

    // ==========================================
    // EVENT CHANNELS
    // ==========================================

    /**
     * Create an event channel
     */
    async createChannel(
        tenantId: string,
        input: CreateEventChannelInput
    ): Promise<EventChannelWithTypes> {
        const channel = await this.prisma.eventChannel.create({
            data: {
                tenantId,
                code: input.code.toUpperCase().replace(/\s+/g, '_'),
                name: input.name,
                description: input.description,
                enabled: input.enabled ?? true,
            },
            include: {
                eventTypes: {
                    select: { id: true, code: true, name: true, enabled: true },
                },
            },
        });

        return this.mapChannel(channel);
    }

    /**
     * List all channels for a tenant
     */
    async listChannels(tenantId: string): Promise<EventChannelWithTypes[]> {
        const channels = await this.prisma.eventChannel.findMany({
            where: { tenantId },
            include: {
                eventTypes: {
                    select: { id: true, code: true, name: true, enabled: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        return channels.map(this.mapChannel);
    }

    /**
     * Get a channel by ID
     */
    async getChannel(tenantId: string, channelId: string): Promise<EventChannelWithTypes | null> {
        const channel = await this.prisma.eventChannel.findFirst({
            where: { id: channelId, tenantId },
            include: {
                eventTypes: {
                    select: { id: true, code: true, name: true, enabled: true },
                },
            },
        });

        return channel ? this.mapChannel(channel) : null;
    }

    /**
     * Get a channel by code
     */
    async getChannelByCode(tenantId: string, code: string): Promise<EventChannelWithTypes | null> {
        const channel = await this.prisma.eventChannel.findFirst({
            where: { tenantId, code: code.toUpperCase() },
            include: {
                eventTypes: {
                    select: { id: true, code: true, name: true, enabled: true },
                },
            },
        });

        return channel ? this.mapChannel(channel) : null;
    }

    /**
     * Update a channel
     */
    async updateChannel(
        tenantId: string,
        channelId: string,
        input: UpdateEventChannelInput
    ): Promise<EventChannelWithTypes> {
        const channel = await this.prisma.eventChannel.update({
            where: { id: channelId, tenantId },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.enabled !== undefined && { enabled: input.enabled }),
            },
            include: {
                eventTypes: {
                    select: { id: true, code: true, name: true, enabled: true },
                },
            },
        });

        return this.mapChannel(channel);
    }

    /**
     * Delete a channel (cascades to event types and handlers)
     */
    async deleteChannel(tenantId: string, channelId: string): Promise<void> {
        await this.prisma.eventChannel.delete({
            where: { id: channelId, tenantId },
        });
    }

    // ==========================================
    // EVENT TYPES
    // ==========================================

    /**
     * Create an event type
     */
    async createEventType(
        tenantId: string,
        input: CreateEventTypeInput
    ): Promise<EventTypeWithHandlers> {
        const eventType = await this.prisma.eventType.create({
            data: {
                tenantId,
                channelId: input.channelId,
                code: input.code.toUpperCase().replace(/\s+/g, '_'),
                name: input.name,
                description: input.description,
                payloadSchema: input.payloadSchema as any,
                enabled: input.enabled ?? true,
            },
            include: {
                channel: { select: { code: true, name: true } },
                handlers: {
                    select: { id: true, name: true, handlerType: true, enabled: true },
                },
            },
        });

        return this.mapEventType(eventType);
    }

    /**
     * List event types for a tenant, optionally filtered by channel
     */
    async listEventTypes(tenantId: string, channelId?: string): Promise<EventTypeWithHandlers[]> {
        const eventTypes = await this.prisma.eventType.findMany({
            where: {
                tenantId,
                ...(channelId && { channelId }),
            },
            include: {
                channel: { select: { code: true, name: true } },
                handlers: {
                    select: { id: true, name: true, handlerType: true, enabled: true },
                },
            },
            orderBy: { code: 'asc' },
        });

        return eventTypes.map(this.mapEventType);
    }

    /**
     * Get an event type by ID
     */
    async getEventType(tenantId: string, eventTypeId: string): Promise<EventTypeWithHandlers | null> {
        const eventType = await this.prisma.eventType.findFirst({
            where: { id: eventTypeId, tenantId },
            include: {
                channel: { select: { code: true, name: true } },
                handlers: {
                    select: { id: true, name: true, handlerType: true, enabled: true },
                },
            },
        });

        return eventType ? this.mapEventType(eventType) : null;
    }

    /**
     * Get an event type by code
     */
    async getEventTypeByCode(tenantId: string, code: string): Promise<EventTypeWithHandlers | null> {
        const eventType = await this.prisma.eventType.findFirst({
            where: { tenantId, code: code.toUpperCase() },
            include: {
                channel: { select: { code: true, name: true } },
                handlers: {
                    select: { id: true, name: true, handlerType: true, enabled: true },
                },
            },
        });

        return eventType ? this.mapEventType(eventType) : null;
    }

    /**
     * Update an event type
     */
    async updateEventType(
        tenantId: string,
        eventTypeId: string,
        input: UpdateEventTypeInput
    ): Promise<EventTypeWithHandlers> {
        const eventType = await this.prisma.eventType.update({
            where: { id: eventTypeId, tenantId },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.payloadSchema !== undefined && { payloadSchema: input.payloadSchema as any }),
                ...(input.enabled !== undefined && { enabled: input.enabled }),
            },
            include: {
                channel: { select: { code: true, name: true } },
                handlers: {
                    select: { id: true, name: true, handlerType: true, enabled: true },
                },
            },
        });

        return this.mapEventType(eventType);
    }

    /**
     * Delete an event type (cascades to handlers)
     */
    async deleteEventType(tenantId: string, eventTypeId: string): Promise<void> {
        await this.prisma.eventType.delete({
            where: { id: eventTypeId, tenantId },
        });
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    /**
     * Create an event handler
     */
    async createHandler(
        tenantId: string,
        input: CreateEventHandlerInput
    ): Promise<EventHandlerWithType> {
        const handler = await this.prisma.eventHandler.create({
            data: {
                tenantId,
                eventTypeId: input.eventTypeId,
                name: input.name,
                description: input.description,
                handlerType: input.handlerType,
                config: input.config as object,
                priority: input.priority ?? 100,
                enabled: input.enabled ?? true,
                maxRetries: input.maxRetries ?? 3,
                retryDelayMs: input.retryDelayMs ?? 1000,
                filterCondition: input.filterCondition,
            },
            include: {
                eventType: {
                    select: {
                        code: true,
                        name: true,
                        channel: { select: { code: true, name: true } },
                    },
                },
            },
        });

        return this.mapHandler(handler);
    }

    /**
     * List handlers for an event type
     */
    async listHandlers(tenantId: string, eventTypeId?: string): Promise<EventHandlerWithType[]> {
        const handlers = await this.prisma.eventHandler.findMany({
            where: {
                tenantId,
                ...(eventTypeId && { eventTypeId }),
            },
            include: {
                eventType: {
                    select: {
                        code: true,
                        name: true,
                        channel: { select: { code: true, name: true } },
                    },
                },
            },
            orderBy: [{ eventTypeId: 'asc' }, { priority: 'asc' }],
        });

        return handlers.map(this.mapHandler);
    }

    /**
     * Get a handler by ID
     */
    async getHandler(tenantId: string, handlerId: string): Promise<EventHandlerWithType | null> {
        const handler = await this.prisma.eventHandler.findFirst({
            where: { id: handlerId, tenantId },
            include: {
                eventType: {
                    select: {
                        code: true,
                        name: true,
                        channel: { select: { code: true, name: true } },
                    },
                },
            },
        });

        return handler ? this.mapHandler(handler) : null;
    }

    /**
     * Update a handler
     */
    async updateHandler(
        tenantId: string,
        handlerId: string,
        input: UpdateEventHandlerInput
    ): Promise<EventHandlerWithType> {
        const handler = await this.prisma.eventHandler.update({
            where: { id: handlerId, tenantId },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.config !== undefined && { config: input.config as object }),
                ...(input.priority !== undefined && { priority: input.priority }),
                ...(input.enabled !== undefined && { enabled: input.enabled }),
                ...(input.maxRetries !== undefined && { maxRetries: input.maxRetries }),
                ...(input.retryDelayMs !== undefined && { retryDelayMs: input.retryDelayMs }),
                ...(input.filterCondition !== undefined && { filterCondition: input.filterCondition }),
            },
            include: {
                eventType: {
                    select: {
                        code: true,
                        name: true,
                        channel: { select: { code: true, name: true } },
                    },
                },
            },
        });

        return this.mapHandler(handler);
    }

    /**
     * Delete a handler
     */
    async deleteHandler(tenantId: string, handlerId: string): Promise<void> {
        await this.prisma.eventHandler.delete({
            where: { id: handlerId, tenantId },
        });
    }

    /**
     * Enable or disable a handler
     */
    async setHandlerEnabled(tenantId: string, handlerId: string, enabled: boolean): Promise<void> {
        await this.prisma.eventHandler.update({
            where: { id: handlerId, tenantId },
            data: { enabled },
        });
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    private mapChannel(channel: any): EventChannelWithTypes {
        return {
            id: channel.id,
            tenantId: channel.tenantId,
            code: channel.code,
            name: channel.name,
            description: channel.description,
            enabled: channel.enabled,
            eventTypes: channel.eventTypes,
            createdAt: channel.createdAt,
            updatedAt: channel.updatedAt,
        };
    }

    private mapEventType(eventType: any): EventTypeWithHandlers {
        return {
            id: eventType.id,
            tenantId: eventType.tenantId,
            channelId: eventType.channelId,
            channel: eventType.channel,
            code: eventType.code,
            name: eventType.name,
            description: eventType.description,
            payloadSchema: eventType.payloadSchema as Record<string, unknown> | null,
            enabled: eventType.enabled,
            handlers: eventType.handlers,
            createdAt: eventType.createdAt,
            updatedAt: eventType.updatedAt,
        };
    }

    private mapHandler(handler: any): EventHandlerWithType {
        return {
            id: handler.id,
            tenantId: handler.tenantId,
            eventTypeId: handler.eventTypeId,
            eventType: handler.eventType,
            name: handler.name,
            description: handler.description,
            handlerType: handler.handlerType,
            config: handler.config as HandlerConfig,
            priority: handler.priority,
            enabled: handler.enabled,
            maxRetries: handler.maxRetries,
            retryDelayMs: handler.retryDelayMs,
            filterCondition: handler.filterCondition,
            createdAt: handler.createdAt,
            updatedAt: handler.updatedAt,
        };
    }
}

/**
 * Create an event config service instance
 */
export function createEventConfigService(prisma: PrismaClient): EventConfigService {
    return new EventConfigService(prisma);
}
