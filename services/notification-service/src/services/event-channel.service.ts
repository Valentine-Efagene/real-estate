import { AppError, createTenantPrisma } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import { CreateEventChannelInput, UpdateEventChannelInput } from '../validators/event-channel.validator';

class EventChannelService {
    /**
     * Create a new event channel
     */
    async create(tenantId: string, data: CreateEventChannelInput): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Check for duplicate code within tenant
        const existing = await prisma.eventChannel.findFirst({
            where: { tenantId, code: data.code },
        });

        if (existing) {
            throw new AppError(409, `Event channel with code '${data.code}' already exists`);
        }

        return tenantPrisma.eventChannel.create({
            data: {
                tenantId,
                code: data.code,
                name: data.name,
                description: data.description,
            },
        });
    }

    /**
     * Find all event channels for a tenant
     */
    async findAll(tenantId: string): Promise<any[]> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        return tenantPrisma.eventChannel.findMany({
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Find a single event channel by ID
     */
    async findById(tenantId: string, id: string): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        const channel = await tenantPrisma.eventChannel.findFirst({
            where: { id },
            include: {
                eventTypes: {
                    orderBy: { name: 'asc' },
                },
            },
        });

        if (!channel) {
            throw new AppError(404, 'Event channel not found');
        }

        return channel;
    }

    /**
     * Find a single event channel by code
     */
    async findByCode(tenantId: string, code: string): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        const channel = await tenantPrisma.eventChannel.findFirst({
            where: { code },
            include: {
                eventTypes: {
                    orderBy: { name: 'asc' },
                },
            },
        });

        if (!channel) {
            throw new AppError(404, `Event channel with code '${code}' not found`);
        }

        return channel;
    }

    /**
     * Update an event channel
     */
    async update(tenantId: string, id: string, data: UpdateEventChannelInput): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Verify channel exists
        await this.findById(tenantId, id);

        return tenantPrisma.eventChannel.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
            },
        });
    }

    /**
     * Delete an event channel
     */
    async delete(tenantId: string, id: string): Promise<void> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Verify channel exists
        const channel = await this.findById(tenantId, id);

        // Check for dependent event types
        const typeCount = await prisma.eventType.count({
            where: { channelId: id },
        });

        if (typeCount > 0) {
            throw new AppError(409, `Cannot delete channel with ${typeCount} event types. Delete event types first.`);
        }

        await tenantPrisma.eventChannel.delete({
            where: { id },
        });
    }
}

export const eventChannelService = new EventChannelService();
