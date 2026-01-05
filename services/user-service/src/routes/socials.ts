import { Router } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { socialService } from '../services/social.service';
import { z } from 'zod';

export const socialRouter = Router();

// Get all social profiles for a user
socialRouter.get('/user/:userId', async (req, res, next) => {
    try {
        const result = await socialService.findAllByUser(req.params.userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Create a social profile
socialRouter.post('/', async (req, res, next) => {
    try {
        const data = z.object({
            userId: z.string(),
            provider: z.string(),
            socialId: z.string(),
        }).parse(req.body);

        const result = await socialService.create(data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Get single social profile
socialRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await socialService.findById(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Update social profile
socialRouter.put('/:id', async (req, res, next) => {
    try {
        const data = z.object({
            provider: z.string().optional(),
            socialId: z.string().optional(),
        }).parse(req.body);

        const result = await socialService.update(req.params.id, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Delete social profile
socialRouter.delete('/:id', async (req, res, next) => {
    try {
        await socialService.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
