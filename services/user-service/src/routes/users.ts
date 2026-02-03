import { Router } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { userService } from '../services/user.service';
import { z } from 'zod';

export const userRouter = Router();

// List users with pagination and filtering
userRouter.get('/', async (req, res, next) => {
    try {
        const params = {
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            sortBy: req.query.sortBy as string | undefined,
            sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
            firstName: req.query.firstName as string | undefined,
            lastName: req.query.lastName as string | undefined,
            email: req.query.email as string | undefined,
        };
        const result = await userService.findAll(params);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Get single user
userRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await userService.findById(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Update user
userRouter.put('/:id', async (req, res, next) => {
    try {
        const updateData = z.object({
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            phone: z.string().optional(),
            avatar: z.string().url().optional(),
            isActive: z.boolean().optional(),
        }).parse(req.body);

        const result = await userService.update(req.params.id, updateData);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Update avatar specifically
userRouter.put('/:id/avatar', async (req, res, next) => {
    try {
        const { avatarUrl } = z.object({
            avatarUrl: z.string().url(),
        }).parse(req.body);

        const result = await userService.update(req.params.id, { avatar: avatarUrl });
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Update profile (for authenticated user)
userRouter.patch('/profile', async (req, res, next) => {
    try {
        const userId = (req as any).userId; // Will be set by auth middleware

        const updateData = z.object({
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            phone: z.string().optional(),
            avatar: z.string().url().optional(),
        }).parse(req.body);

        const result = await userService.update(userId, updateData);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Change password (for authenticated user)
userRouter.post('/change-password', async (req, res, next) => {
    try {
        const userId = (req as any).userId;

        const { currentPassword, newPassword } = z.object({
            currentPassword: z.string().min(1, 'Current password is required'),
            newPassword: z.string().min(8, 'New password must be at least 8 characters'),
        }).parse(req.body);

        const result = await userService.changePassword(userId, currentPassword, newPassword);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Suspend user
userRouter.post('/:id/suspend', async (req, res, next) => {
    try {
        const { reason } = z.object({
            reason: z.string().optional(),
        }).parse(req.body);

        const result = await userService.suspend(req.params.id, reason);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Reinstate user
userRouter.post('/:id/reinstate', async (req, res, next) => {
    try {
        const result = await userService.reinstate(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Assign roles to user
userRouter.put('/:id/roles', async (req, res, next) => {
    try {
        const { roleIds } = z.object({
            roleIds: z.array(z.string()),
        }).parse(req.body);

        const result = await userService.assignRoles(req.params.id, roleIds);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Delete user
userRouter.delete('/:id', async (req, res, next) => {
    try {
        await userService.delete(req.params.id);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
