import { Router } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { permissionService } from '../services/permission.service';
import { z } from 'zod';

export const permissionRouter = Router();

// Get all permissions
permissionRouter.get('/', async (req, res, next) => {
    try {
        const result = await permissionService.findAll();
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Create a permission
permissionRouter.post('/', async (req, res, next) => {
    try {
        const data = z.object({
            name: z.string(),
            description: z.string().optional(),
            resource: z.string(),
            action: z.string(),
        }).parse(req.body);

        const result = await permissionService.create(data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Get a permission by ID
permissionRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await permissionService.findById(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Update a permission
permissionRouter.put('/:id', async (req, res, next) => {
    try {
        const data = z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            resource: z.string().optional(),
            action: z.string().optional(),
        }).parse(req.body);

        const result = await permissionService.update(req.params.id, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Delete a permission
permissionRouter.delete('/:id', async (req, res, next) => {
    try {
        await permissionService.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
