import { Router } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { permissionService } from '../services/permission.service';
import { z } from 'zod';

export const permissionRouter = Router();

const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', '*']);
const effectSchema = z.enum(['ALLOW', 'DENY']);

// Get all permissions (optionally filtered by tenant)
permissionRouter.get('/', async (req, res, next) => {
    try {
        const tenantId = req.query.tenantId as string | undefined;
        const result = await permissionService.findAll(tenantId);
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
            path: z.string().startsWith('/'),
            methods: z.array(httpMethodSchema),
            effect: effectSchema.optional(),
            tenantId: z.string().optional().nullable(),
        }).parse(req.body);

        const result = await permissionService.create(data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Bulk create permissions
permissionRouter.post('/bulk', async (req, res, next) => {
    try {
        const { permissions } = z.object({
            permissions: z.array(z.object({
                name: z.string(),
                description: z.string().optional(),
                path: z.string().startsWith('/'),
                methods: z.array(httpMethodSchema),
                effect: effectSchema.optional(),
                tenantId: z.string().optional().nullable(),
            })),
        }).parse(req.body);

        const result = await permissionService.bulkCreate(permissions);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Create CRUD permissions for a resource
permissionRouter.post('/crud', async (req, res, next) => {
    try {
        const cuidRegex = /^c[a-z0-9]{24}$/;
        const data = z.object({
            resourcePath: z.string().startsWith('/'),
            resourceName: z.string(),
            tenantId: z.string().regex(cuidRegex).optional(),
        }).parse(req.body);

        const result = await permissionService.createCrudPermissions(
            data.resourcePath,
            data.resourceName,
            data.tenantId
        );
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
            path: z.string().startsWith('/').optional(),
            methods: z.array(httpMethodSchema).optional(),
            effect: effectSchema.optional(),
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

// Get roles that have this permission
permissionRouter.get('/:id/roles', async (req, res, next) => {
    try {
        const result = await permissionService.getRoles(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});
