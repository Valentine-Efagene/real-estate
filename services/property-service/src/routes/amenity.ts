import { Router, type Router as RouterType } from 'express';
import { successResponse, AppError } from '@valentine-efagene/qshelter-common';
import { createAmenitySchema, updateAmenitySchema } from '../validators/amenity.validator';
import { amenityService } from '../services/amenity.service';

export const amenityRouter: RouterType = Router();

// Amenities CRUD
amenityRouter.post('/amenities', async (req, res, next) => {
    try {
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            throw new AppError(401, 'Tenant context required');
        }
        const data = createAmenitySchema.parse(req.body);
        const amenity = await amenityService.createAmenity(data, tenantId);
        res.status(201).json(successResponse(amenity));
    } catch (error) {
        next(error);
    }
});

amenityRouter.get('/amenities', async (req, res, next) => {
    try {
        const amenities = await amenityService.getAmenities();
        res.json(successResponse(amenities));
    } catch (error) {
        next(error);
    }
});

amenityRouter.get('/amenities/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const amenity = await amenityService.getAmenityById(id);
        res.json(successResponse(amenity));
    } catch (error) {
        next(error);
    }
});

amenityRouter.put('/amenities/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateAmenitySchema.parse(req.body);
        const amenity = await amenityService.updateAmenity(id, data);
        res.json(successResponse(amenity));
    } catch (error) {
        next(error);
    }
});

amenityRouter.delete('/amenities/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await amenityService.deleteAmenity(id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});
