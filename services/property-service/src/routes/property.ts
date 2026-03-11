import { Router, type Router as RouterType } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import {
    createPropertySchema,
    updatePropertySchema,
} from '../validators/property.validator';
import {
    createPropertyPromotionSchema,
    updatePropertyPromotionSchema,
} from '../validators/property-promotion.validator';
import { propertyService } from '../services/property.service';

export const propertyRouter: RouterType = Router();

function parseNumber(value?: string): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePropertyListQuery(query: Record<string, string | undefined>, tenantId?: string) {
    const {
        keyword,
        category,
        propertyType,
        city,
        country,
        status,
        minPrice,
        maxPrice,
        minBedrooms,
        maxBedrooms,
        availableUnitsOnly,
        organizationId,
        sortBy,
        page,
        limit,
    } = query;

    return {
        tenantId,
        keyword,
        category,
        propertyType,
        city,
        country,
        status,
        minPrice: parseNumber(minPrice),
        maxPrice: parseNumber(maxPrice),
        minBedrooms: parseNumber(minBedrooms),
        maxBedrooms: parseNumber(maxBedrooms),
        availableUnitsOnly: availableUnitsOnly === 'true' ? true : undefined,
        organizationId,
        sortBy: sortBy as 'price_asc' | 'price_desc' | 'newest' | 'oldest' | undefined,
        page: parseNumber(page),
        limit: parseNumber(limit),
    };
}

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
        const tenantId = req.tenantContext?.tenantId;
        const query = req.query as Record<string, string | undefined>;
        const properties = await propertyService.getProperties(parsePropertyListQuery(query, tenantId));
        res.json(successResponse(properties));
    } catch (error) {
        next(error);
    }
});

// Property search — must be defined before /properties/:id to avoid route shadowing
propertyRouter.get('/properties/search', async (req, res, next) => {
    try {
        const tenantId = req.tenantContext?.tenantId;
        const query = req.query as Record<string, string | undefined>;
        const results = await propertyService.searchProperties(parsePropertyListQuery(query, tenantId));

        res.json(successResponse(results));
    } catch (error) {
        next(error);
    }
});

propertyRouter.get('/properties/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        const property = await propertyService.getPropertyById(id, tenantId);
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

        // Accept multiple formats:
        // 1. Array directly: [{ url, type, order?, caption? }]
        // 2. Object with media property: { media: [...] }
        // 3. Single object: { url, type, order?, caption? }
        let mediaItems: Array<{ url: string; type: string; order?: number; caption?: string }>;
        if (Array.isArray(req.body)) {
            mediaItems = req.body;
        } else if (req.body.media && Array.isArray(req.body.media)) {
            mediaItems = req.body.media;
        } else if (req.body.url) {
            mediaItems = [req.body];
        } else {
            return res.status(400).json({ success: false, error: 'Invalid media format. Expected array or { media: [...] }' });
        }

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

// Property Promotions
propertyRouter.post('/properties/:id/promotions', async (req, res, next) => {
    try {
        const tenantId = req.tenantContext?.tenantId;
        const userId = req.tenantContext?.userId || 'temp-user-id';
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const data = createPropertyPromotionSchema.parse(req.body);
        const promotion = await propertyService.createPromotion(req.params.id, data, tenantId, userId);
        res.status(201).json(successResponse(promotion));
    } catch (error) {
        next(error);
    }
});

propertyRouter.get('/properties/:id/promotions', async (req, res, next) => {
    try {
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const promotions = await propertyService.listPromotions(req.params.id, tenantId);
        res.json(successResponse(promotions));
    } catch (error) {
        next(error);
    }
});

propertyRouter.patch('/properties/:id/promotions/:promotionId', async (req, res, next) => {
    try {
        const tenantId = req.tenantContext?.tenantId;
        const userId = req.tenantContext?.userId || 'temp-user-id';
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const data = updatePropertyPromotionSchema.parse(req.body);
        const promotion = await propertyService.updatePromotion(req.params.id, req.params.promotionId, data, tenantId, userId);
        res.json(successResponse(promotion));
    } catch (error) {
        next(error);
    }
});

propertyRouter.delete('/properties/:id/promotions/:promotionId', async (req, res, next) => {
    try {
        const tenantId = req.tenantContext?.tenantId;
        const userId = req.tenantContext?.userId || 'temp-user-id';
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const result = await propertyService.deletePromotion(req.params.id, req.params.promotionId, tenantId, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

