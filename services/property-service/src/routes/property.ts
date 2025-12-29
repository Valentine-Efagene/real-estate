import { Router, type Router as RouterType } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import {
    createPropertySchema,
    updatePropertySchema,
} from '../validators/property.validator.js';
import { propertyService } from '../services/property.service.js';

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
        // TODO: Extract userId from auth context/JWT
        const userId = (req as any).userId || 'temp-user-id';
        const property = await propertyService.createProperty(data, userId);
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
        // TODO: Extract userId from auth context/JWT
        const userId = (req as any).userId || 'temp-user-id';
        const property = await propertyService.updateProperty(id, data, userId);
        res.json(successResponse(property));
    } catch (error) {
        next(error);
    }
});

propertyRouter.delete('/properties/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        // TODO: Extract userId from auth context/JWT
        const userId = (req as any).userId || 'temp-user-id';
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

