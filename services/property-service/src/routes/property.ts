import { Router, type Router as RouterType } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import {
    createPropertySchema,
    updatePropertySchema,
} from '../validators/property.validator';
import { propertyService } from '../services/property.service';

export const propertyRouter: RouterType = Router();

// Minimal DB sanity route (uses Prisma from qshelter-common)
propertyRouter.get('/db/ping', async (req, res, next) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json(successResponse({ ok: true }));
    } catch (err) {
        next(err as Error);
    }
});

// Properties CRUD
propertyRouter.post('/properties', async (req, res, next) => {
    try {
        const data = createPropertySchema.parse(req.body);
        // Extract from tenant context (set by tenant middleware)
        const userId = req.tenantContext?.userId || 'temp-user-id';
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }
        const property = await propertyService.createProperty(data, userId, tenantId);
        res.status(201).json(successResponse(property));
    } catch (error) {
        next(error);
    }
});

propertyRouter.get('/properties', async (req, res, next) => {
    try {
        const properties = await propertyService.getProperties();
        res.json(successResponse(properties));
    } catch (error) {
        next(error);
    }
});

propertyRouter.get('/properties/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const property = await propertyService.getPropertyById(id);
        res.json(successResponse(property));
    } catch (error) {
        next(error);
    }
});

propertyRouter.put('/properties/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updatePropertySchema.parse(req.body);
        // Extract userId from tenant context (set by tenant middleware)
        const userId = req.tenantContext?.userId || 'temp-user-id';
        const property = await propertyService.updateProperty(id, data, userId);
        res.json(successResponse(property));
    } catch (error) {
        next(error);
    }
});

propertyRouter.delete('/properties/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        // Extract userId from tenant context (set by tenant middleware)
        const userId = req.tenantContext?.userId || 'temp-user-id';
        const result = await propertyService.deleteProperty(id, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Property Media
propertyRouter.get('/property-media/:propertyId', async (req, res, next) => {
    try {
        const { propertyId } = req.params;
        const media = await propertyService.getPropertyMedia(propertyId);
        res.json(successResponse(media));
    } catch (error) {
        next(error);
    }
});

// Add media to property
propertyRouter.post('/properties/:id/media', async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }
        
        // Expect array of media items: [{ url, type, order?, caption? }]
        const mediaItems = Array.isArray(req.body) ? req.body : [req.body];
        const created = await propertyService.addPropertyMedia(id, tenantId, mediaItems);
        res.status(201).json(successResponse(created));
    } catch (error) {
        next(error);
    }
});

// Delete property media
propertyRouter.delete('/property-media/:mediaId', async (req, res, next) => {
    try {
        const { mediaId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }
        const result = await propertyService.deletePropertyMedia(mediaId, tenantId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Property Documents
propertyRouter.get('/property-document/:propertyId', async (req, res, next) => {
    try {
        const { propertyId } = req.params;
        const documents = await propertyService.getPropertyDocuments(propertyId);
        res.json(successResponse(documents));
    } catch (error) {
        next(error);
    }
});

// Publish property
propertyRouter.patch('/properties/:id/publish', async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }
        const property = await propertyService.publishProperty(id, tenantId);
        res.json(successResponse(property));
    } catch (error) {
        next(error);
    }
});

// Unpublish property
propertyRouter.patch('/properties/:id/unpublish', async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }
        const property = await propertyService.unpublishProperty(id, tenantId);
        res.json(successResponse(property));
    } catch (error) {
        next(error);
    }
});

