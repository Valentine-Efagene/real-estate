import { Router } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { tenantService } from '../services/tenant.service.js';
import { z } from 'zod';

export const tenantRouter = Router();

tenantRouter.get('/', async (req, res, next) => {
    try {
        const result = await tenantService.findAll();
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

tenantRouter.post('/', async (req, res, next) => {
    try {
        const data = z.object({
            name: z.string(),
            subdomain: z.string(),
        }).parse(req.body);

        const result = await tenantService.create(data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

tenantRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await tenantService.findById(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

tenantRouter.get('/subdomain/:subdomain', async (req, res, next) => {
    try {
        const result = await tenantService.findBySubdomain(req.params.subdomain);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

tenantRouter.put('/:id', async (req, res, next) => {
    try {
        const data = z.object({
            name: z.string().optional(),
            subdomain: z.string().optional(),
            isActive: z.boolean().optional(),
        }).parse(req.body);

        const result = await tenantService.update(req.params.id, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

tenantRouter.delete('/:id', async (req, res, next) => {
    try {
        await tenantService.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
