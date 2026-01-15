import { Router, Request, Response, NextFunction } from 'express';
import { eventChannelService } from '../services/event-channel.service';
import { createResponse } from '../helpers/response';
import {
    CreateEventChannelSchema,
    UpdateEventChannelSchema,
} from '../validators/event-channel.validator';

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
 * POST /event-channels
 * Create a new event channel
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const parsed = CreateEventChannelSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const channel = await eventChannelService.create(tenantId, parsed.data);
    res.status(201).json(createResponse(201, 'Event channel created', channel));
}));

/**
 * GET /event-channels
 * List all event channels for the tenant
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const channels = await eventChannelService.findAll(tenantId);
    res.json(createResponse(200, 'Event channels retrieved', channels));
}));

/**
 * GET /event-channels/:id
 * Get a single event channel by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const channel = await eventChannelService.findById(tenantId, id);
    res.json(createResponse(200, 'Event channel retrieved', channel));
}));

/**
 * GET /event-channels/code/:code
 * Get a single event channel by code
 */
router.get('/code/:code', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { code } = req.params;

    const channel = await eventChannelService.findByCode(tenantId, code);
    res.json(createResponse(200, 'Event channel retrieved', channel));
}));

/**
 * PATCH /event-channels/:id
 * Update an event channel
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const parsed = UpdateEventChannelSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const channel = await eventChannelService.update(tenantId, id, parsed.data);
    res.json(createResponse(200, 'Event channel updated', channel));
}));

/**
 * DELETE /event-channels/:id
 * Delete an event channel
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    await eventChannelService.delete(tenantId, id);
    res.json(createResponse(200, 'Event channel deleted'));
}));

export default router;
