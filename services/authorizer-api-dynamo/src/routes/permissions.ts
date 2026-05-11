import { Router } from 'express';
import { z } from 'zod';
import { permissionService } from '../services/permission.service';
import {
    createPermissionSchema,
    roleNameSchema,
    updatePermissionSchema,
} from '../validators/permission.validator';

export const permissionRouter = Router();

const roleNameParamSchema = roleNameSchema;

permissionRouter.get('/', async (req, res, next) => {
    try {
        const roleName =
            typeof req.query.roleName === 'string'
                ? roleNameSchema.parse(req.query.roleName)
                : undefined;

        const isActive =
            typeof req.query.isActive === 'string'
                ? req.query.isActive === 'true'
                : undefined;

        const permissions = await permissionService.findAll({ roleName, isActive });
        res.json({ success: true, data: permissions });
    } catch (error) {
        next(error);
    }
});

permissionRouter.post('/', async (req, res, next) => {
    try {
        const input = createPermissionSchema.parse(req.body);
        const permission = await permissionService.create(input);
        res.status(201).json({ success: true, data: permission });
    } catch (error) {
        next(error);
    }
});

permissionRouter.get('/:roleName', async (req, res, next) => {
    try {
        const roleName = roleNameSchema.parse(req.params.roleName);
        const permission = await permissionService.findByRoleName(roleName);
        res.json({ success: true, data: permission });
    } catch (error) {
        next(error);
    }
});

permissionRouter.put('/:roleName', async (req, res, next) => {
    try {
        const roleName = roleNameSchema.parse(req.params.roleName);
        const input = updatePermissionSchema.parse(req.body);
        const permission = await permissionService.updateByRoleName(roleName, input);
        res.json({ success: true, data: permission });
    } catch (error) {
        next(error);
    }
});

permissionRouter.patch('/:roleName', async (req, res, next) => {
    try {
        const roleName = roleNameSchema.parse(req.params.roleName);
        const input = updatePermissionSchema.parse(req.body);
        const permission = await permissionService.updateByRoleName(roleName, input);
        res.json({ success: true, data: permission });
    } catch (error) {
        next(error);
    }
});

permissionRouter.delete('/:roleName', async (req, res, next) => {
    try {
        const roleName = roleNameSchema.parse(req.params.roleName);
        const result = await permissionService.deleteByRoleName(roleName);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});
