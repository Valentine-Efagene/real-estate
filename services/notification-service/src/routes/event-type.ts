import { Router, Request, Response, NextFunction } from 'express';
import { eventTypeService } from '../services/event-type.service';
import { createResponse } from '../helpers/response';
import {
    CreateEventTypeSchema,
    UpdateEventTypeSchema,
} from '../validators/event-type.validator';

const router = Router();

// Helper function to wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

// Get tenant ID from request (set by API Gateway authorizer)
const getTenantId = (req: Request): string => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }
    return tenantId;
};

/**
 * POST /event-types
 * Create a new event type
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const parsed = CreateEventTypeSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const eventType = await eventTypeService.create(tenantId, parsed.data);
    res.status(201).json(createResponse(201, 'Event type created', eventType));
}));

/**
 * GET /event-types
 * List all event types for the tenant
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { channelId } = req.query;

    const filters: { channelId?: string } = {};
    if (channelId) filters.channelId = channelId as string;

    const eventTypes = await eventTypeService.findAll(tenantId, filters);
    res.json(createResponse(200, 'Event types retrieved', eventTypes));
}));

/**
 * GET /event-types/:id
 * Get a single event type by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const eventType = await eventTypeService.findById(tenantId, id);
    res.json(createResponse(200, 'Event type retrieved', eventType));
}));

/**
 * PATCH /event-types/:id
 * Update an event type
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const parsed = UpdateEventTypeSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const eventType = await eventTypeService.update(tenantId, id, parsed.data);
    res.json(createResponse(200, 'Event type updated', eventType));
}));

/**
 * DELETE /event-types/:id
 * Delete an event type
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    await eventTypeService.delete(tenantId, id);
    res.json(createResponse(200, 'Event type deleted'));
}));

export default router;
