import { AppError, createTenantPrisma } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import { CreateEventTypeInput, UpdateEventTypeInput } from '../validators/event-type.validator';

class EventTypeService {
    /**
     * Create a new event type
     */
    async create(tenantId: string, data: CreateEventTypeInput): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Verify channel exists and belongs to tenant
        const channel = await prisma.eventChannel.findFirst({
            where: { id: data.channelId, tenantId },
        });

        if (!channel) {
            throw new AppError(404, 'Event channel not found');
        }

        // Check for duplicate code within channel
        const existing = await prisma.eventType.findFirst({
            where: { channelId: data.channelId, code: data.code },
        });

        if (existing) {
            throw new AppError(409, `Event type with code '${data.code}' already exists in this channel`);
        }

        return tenantPrisma.eventType.create({
            data: {
                tenantId,
                channelId: data.channelId,
                code: data.code,
                name: data.name,
                description: data.description,
            },
            include: {
                channel: true,
            },
        });
    }

    /**
     * Find all event types for a tenant
     */
    async findAll(tenantId: string, filters?: { channelId?: string }): Promise<any[]> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        const where: any = {};
        if (filters?.channelId) {
            where.channelId = filters.channelId;
        }

        return tenantPrisma.eventType.findMany({
            where,
            include: {
                channel: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Find a single event type by ID
     */
    async findById(tenantId: string, id: string): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        const eventType = await tenantPrisma.eventType.findFirst({
            where: { id },
            include: {
                channel: true,
                handlers: {
                    orderBy: { priority: 'asc' },
                },
            },
        });

        if (!eventType) {
            throw new AppError(404, 'Event type not found');
        }

        return eventType;
    }

    /**
     * Find a single event type by code within a channel
     */
    async findByCode(tenantId: string, channelId: string, code: string): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        const eventType = await tenantPrisma.eventType.findFirst({
            where: { channelId, code },
            include: {
                channel: true,
                handlers: {
                    orderBy: { priority: 'asc' },
                },
            },
        });

        if (!eventType) {
            throw new AppError(404, `Event type with code '${code}' not found in channel`);
        }

        return eventType;
    }

    /**
     * Update an event type
     */
    async update(tenantId: string, id: string, data: UpdateEventTypeInput): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Verify event type exists
        await this.findById(tenantId, id);

        return tenantPrisma.eventType.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
            },
            include: {
                channel: true,
            },
        });
    }

    /**
     * Delete an event type
     */
    async delete(tenantId: string, id: string): Promise<void> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Verify event type exists
        await this.findById(tenantId, id);

        // Check for dependent handlers
        const handlerCount = await prisma.eventHandler.count({
            where: { eventTypeId: id },
        });

        if (handlerCount > 0) {
            throw new AppError(409, `Cannot delete event type with ${handlerCount} handlers. Delete handlers first.`);
        }

        await tenantPrisma.eventType.delete({
            where: { id },
        });
    }
}

export const eventTypeService = new EventTypeService();
