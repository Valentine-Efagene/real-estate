import { Router, Request, Response, NextFunction } from 'express';
import { eventHandlerService } from '../services/event-handler.service';
import { createResponse } from '../helpers/response';
import {
    CreateEventHandlerSchema,
    UpdateEventHandlerSchema,
} from '../validators/event-handler.validator';

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
 * POST /event-handlers
 * Create a new event handler
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const parsed = CreateEventHandlerSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const handler = await eventHandlerService.create(tenantId, parsed.data);
    res.status(201).json(createResponse(201, 'Event handler created', handler));
}));

/**
 * GET /event-handlers
 * List all event handlers for the tenant
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { eventTypeId, enabled } = req.query;

    const filters: { eventTypeId?: string; enabled?: boolean } = {};
    if (eventTypeId) filters.eventTypeId = eventTypeId as string;
    if (enabled !== undefined) filters.enabled = enabled === 'true';

    const handlers = await eventHandlerService.findAll(tenantId, filters);
    res.json(createResponse(200, 'Event handlers retrieved', handlers));
}));

/**
 * GET /event-handlers/:id
 * Get a single event handler by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const handler = await eventHandlerService.findById(tenantId, id);
    res.json(createResponse(200, 'Event handler retrieved', handler));
}));

/**
 * PATCH /event-handlers/:id
 * Update an event handler
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const parsed = UpdateEventHandlerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const handler = await eventHandlerService.update(tenantId, id, parsed.data);
    res.json(createResponse(200, 'Event handler updated', handler));
}));

/**
 * DELETE /event-handlers/:id
 * Delete an event handler
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    await eventHandlerService.delete(tenantId, id);
    res.json(createResponse(200, 'Event handler deleted'));
}));

/**
 * POST /event-handlers/:id/toggle
 * Toggle event handler enabled status
 */
router.post('/:id/toggle', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const handler = await eventHandlerService.toggleEnabled(tenantId, id);
    res.json(createResponse(200, 'Event handler toggled', handler));
}));

export default router;
