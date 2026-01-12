import { AppError, createTenantPrisma } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import { CreateEventHandlerInput, UpdateEventHandlerInput } from '../validators/event-handler.validator';

class EventHandlerService {
    /**
     * Create a new event handler
     */
    async create(tenantId: string, data: CreateEventHandlerInput): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Verify event type exists and belongs to tenant
        const eventType = await prisma.eventType.findFirst({
            where: { id: data.eventTypeId, tenantId },
        });

        if (!eventType) {
            throw new AppError(404, 'Event type not found');
        }

        return tenantPrisma.eventHandler.create({
            data: {
                tenantId,
                eventTypeId: data.eventTypeId,
                name: data.name,
                description: data.description,
                handlerType: data.handlerType,
                config: data.config as any,
                priority: data.priority ?? 100,
                enabled: data.enabled ?? true,
                maxRetries: data.maxRetries ?? 3,
                retryDelayMs: data.retryDelayMs ?? 1000,
                filterCondition: data.filterCondition,
            },
            include: {
                eventType: true,
            },
        });
    }

    /**
     * Find all event handlers for a tenant
     */
    async findAll(tenantId: string, filters?: { eventTypeId?: string; enabled?: boolean }): Promise<any[]> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        const where: any = {};
        if (filters?.eventTypeId) {
            where.eventTypeId = filters.eventTypeId;
        }
        if (filters?.enabled !== undefined) {
            where.enabled = filters.enabled;
        }

        return tenantPrisma.eventHandler.findMany({
            where,
            include: {
                eventType: true,
            },
            orderBy: { priority: 'asc' },
        });
    }

    /**
     * Find a single event handler by ID
     */
    async findById(tenantId: string, id: string): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        const handler = await tenantPrisma.eventHandler.findFirst({
            where: { id },
            include: {
                eventType: true,
                stepAttachments: {
                    include: { step: true },
                },
                phaseAttachments: {
                    include: { phase: true },
                },
            },
        });

        if (!handler) {
            throw new AppError(404, 'Event handler not found');
        }

        return handler;
    }

    /**
     * Update an event handler
     */
    async update(tenantId: string, id: string, data: UpdateEventHandlerInput): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Verify handler exists
        await this.findById(tenantId, id);

        // If changing event type, verify it exists
        if (data.eventTypeId) {
            const eventType = await prisma.eventType.findFirst({
                where: { id: data.eventTypeId, tenantId },
            });

            if (!eventType) {
                throw new AppError(404, 'Event type not found');
            }
        }

        return tenantPrisma.eventHandler.update({
            where: { id },
            data: {
                ...(data.eventTypeId && { eventTypeId: data.eventTypeId }),
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.handlerType && { handlerType: data.handlerType }),
                ...(data.config && { config: data.config as any }),
                ...(data.priority !== undefined && { priority: data.priority }),
                ...(data.enabled !== undefined && { enabled: data.enabled }),
                ...(data.maxRetries !== undefined && { maxRetries: data.maxRetries }),
                ...(data.retryDelayMs !== undefined && { retryDelayMs: data.retryDelayMs }),
                ...(data.filterCondition !== undefined && { filterCondition: data.filterCondition }),
            },
            include: {
                eventType: true,
            },
        });
    }

    /**
     * Delete an event handler
     */
    async delete(tenantId: string, id: string): Promise<void> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Verify handler exists
        await this.findById(tenantId, id);

        await tenantPrisma.eventHandler.delete({
            where: { id },
        });
    }

    /**
     * Toggle handler enabled status
     */
    async toggleEnabled(tenantId: string, id: string): Promise<any> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        const handler = await this.findById(tenantId, id);

        return tenantPrisma.eventHandler.update({
            where: { id },
            data: { enabled: !handler.enabled },
            include: {
                eventType: true,
            },
        });
    }
}

export const eventHandlerService = new EventHandlerService();
