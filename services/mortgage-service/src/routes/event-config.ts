/**
 * Event Configuration Routes
 *
 * Admin API for configuring event channels, types, and handlers.
 * Allows Jinx to set up automation triggers like:
 * - Call credit score API when documentation step is submitted
 * - Send email when step is approved/rejected
 * - Call webhooks based on workflow transitions
 *
 * Routes:
 * - /event-config/channels - CRUD for event channels
 * - /event-config/types - CRUD for event types
 * - /event-config/handlers - CRUD for event handlers
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
    EventConfigService,
    createEventConfigService,
    PrismaClient,
    getAuthContext,
} from '@valentine-efagene/qshelter-common';
import { z } from 'zod';
import {
    CreateEventChannelSchema,
    UpdateEventChannelSchema,
    CreateEventTypeSchema,
    UpdateEventTypeSchema,
    CreateEventHandlerSchema,
    UpdateEventHandlerSchema,
} from '../validators/event-config.validator';

const router = Router();

// Lazy init service
let eventConfigService: EventConfigService | null = null;

function getEventConfigService(prisma: PrismaClient): EventConfigService {
    if (!eventConfigService) {
        eventConfigService = createEventConfigService(prisma);
    }
    return eventConfigService;
}

// =============================================================================
// EVENT CHANNELS
// =============================================================================

/**
 * POST /event-config/channels
 * Create a new event channel
 */
router.post('/channels', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreateEventChannelSchema.parse(req.body);
        const service = getEventConfigService(req.app.get('prisma'));
        const channel = await service.createChannel(tenantId, data);
        res.status(201).json(channel);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * GET /event-config/channels
 * List all event channels for the tenant
 */
router.get('/channels', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        const channels = await service.listChannels(tenantId);
        res.json(channels);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /event-config/channels/:id
 * Get a channel by ID
 */
router.get('/channels/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        const channel = await service.getChannel(tenantId, req.params.id);
        if (!channel) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }
        res.json(channel);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /event-config/channels/:id
 * Update a channel
 */
router.patch('/channels/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = UpdateEventChannelSchema.parse(req.body);
        const service = getEventConfigService(req.app.get('prisma'));
        const channel = await service.updateChannel(tenantId, req.params.id, data);
        res.json(channel);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * DELETE /event-config/channels/:id
 * Delete a channel (cascades to event types and handlers)
 */
router.delete('/channels/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        await service.deleteChannel(tenantId, req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * POST /event-config/types
 * Create a new event type
 */
router.post('/types', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreateEventTypeSchema.parse(req.body);
        const service = getEventConfigService(req.app.get('prisma'));
        const eventType = await service.createEventType(tenantId, data);
        res.status(201).json(eventType);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * GET /event-config/types
 * List all event types for the tenant
 * Query params: ?channelId=xxx to filter by channel
 */
router.get('/types', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const channelId = req.query.channelId as string | undefined;
        const service = getEventConfigService(req.app.get('prisma'));
        const types = await service.listEventTypes(tenantId, channelId);
        res.json(types);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /event-config/types/:id
 * Get an event type by ID
 */
router.get('/types/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        const eventType = await service.getEventType(tenantId, req.params.id);
        if (!eventType) {
            res.status(404).json({ error: 'Event type not found' });
            return;
        }
        res.json(eventType);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /event-config/types/:id
 * Update an event type
 */
router.patch('/types/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = UpdateEventTypeSchema.parse(req.body);
        const service = getEventConfigService(req.app.get('prisma'));
        const eventType = await service.updateEventType(tenantId, req.params.id, data);
        res.json(eventType);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * DELETE /event-config/types/:id
 * Delete an event type (cascades to handlers)
 */
router.delete('/types/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        await service.deleteEventType(tenantId, req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * POST /event-config/handlers
 * Create a new event handler
 */
router.post('/handlers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreateEventHandlerSchema.parse(req.body);
        const service = getEventConfigService(req.app.get('prisma'));
        const handler = await service.createHandler(tenantId, {
            eventTypeId: data.eventTypeId,
            name: data.name,
            description: data.description,
            handlerType: data.handlerType,
            config: data.config,
            priority: data.priority,
            enabled: data.enabled,
            maxRetries: data.maxRetries,
            retryDelayMs: data.retryDelayMs,
            filterCondition: data.filterCondition,
        });
        res.status(201).json(handler);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * GET /event-config/handlers
 * List all handlers for the tenant
 * Query params: ?eventTypeId=xxx to filter by event type
 */
router.get('/handlers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const eventTypeId = req.query.eventTypeId as string | undefined;
        const service = getEventConfigService(req.app.get('prisma'));
        const handlers = await service.listHandlers(tenantId, eventTypeId);
        res.json(handlers);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /event-config/handlers/:id
 * Get a handler by ID
 */
router.get('/handlers/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        const handler = await service.getHandler(tenantId, req.params.id);
        if (!handler) {
            res.status(404).json({ error: 'Handler not found' });
            return;
        }
        res.json(handler);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /event-config/handlers/:id
 * Update a handler
 */
router.patch('/handlers/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = UpdateEventHandlerSchema.parse(req.body);
        const service = getEventConfigService(req.app.get('prisma'));
        const handler = await service.updateHandler(tenantId, req.params.id, {
            name: data.name,
            description: data.description,
            config: data.config,
            priority: data.priority,
            enabled: data.enabled,
            maxRetries: data.maxRetries,
            retryDelayMs: data.retryDelayMs,
            filterCondition: data.filterCondition,
        });
        res.json(handler);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * DELETE /event-config/handlers/:id
 * Delete a handler
 */
router.delete('/handlers/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        await service.deleteHandler(tenantId, req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

/**
 * POST /event-config/handlers/:id/enable
 * Enable a handler
 */
router.post('/handlers/:id/enable', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        await service.setHandlerEnabled(tenantId, req.params.id, true);
        res.json({ success: true, enabled: true });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /event-config/handlers/:id/disable
 * Disable a handler
 */
router.post('/handlers/:id/disable', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const service = getEventConfigService(req.app.get('prisma'));
        await service.setHandlerEnabled(tenantId, req.params.id, false);
        res.json({ success: true, enabled: false });
    } catch (error) {
        next(error);
    }
});

export default router;
