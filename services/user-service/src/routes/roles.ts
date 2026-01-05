import { Router } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { roleService } from '../services/role.service';
import { z } from 'zod';

export const roleRouter = Router();

roleRouter.get('/', async (req, res, next) => {
    try {
        const result = await roleService.findAll();
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

roleRouter.post('/', async (req, res, next) => {
    try {
        const data = z.object({
            name: z.string(),
            description: z.string().optional(),
        }).parse(req.body);

        const result = await roleService.create(data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

roleRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await roleService.findById(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

roleRouter.put('/:id', async (req, res, next) => {
    try {
        const data = z.object({
            name: z.string().optional(),
            description: z.string().optional(),
        }).parse(req.body);

        const result = await roleService.update(req.params.id, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

roleRouter.delete('/:id', async (req, res, next) => {
    try {
        await roleService.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
