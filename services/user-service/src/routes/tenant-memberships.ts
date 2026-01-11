import { Router } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { tenantMembershipService } from '../services/tenant-membership.service';
import { z } from 'zod';

export const tenantMembershipRouter = Router();

/**
 * Get all members of a tenant
 * GET /tenants/:tenantId/members
 */
tenantMembershipRouter.get('/tenants/:tenantId/members', async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const result = await tenantMembershipService.findByTenant(tenantId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Add a member to a tenant
 * POST /tenants/:tenantId/members
 */
tenantMembershipRouter.post('/tenants/:tenantId/members', async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const data = z.object({
            userId: z.string(),
            roleId: z.string(),
            isDefault: z.boolean().optional(),
        }).parse(req.body);

        const result = await tenantMembershipService.create({
            ...data,
            tenantId,
        });
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Get a specific membership
 * GET /tenants/:tenantId/members/:userId
 */
tenantMembershipRouter.get('/tenants/:tenantId/members/:userId', async (req, res, next) => {
    try {
        const { tenantId, userId } = req.params;
        const result = await tenantMembershipService.findByUserAndTenant(userId, tenantId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Update a member's role or status in a tenant
 * PUT /tenants/:tenantId/members/:userId
 */
tenantMembershipRouter.put('/tenants/:tenantId/members/:userId', async (req, res, next) => {
    try {
        const { tenantId, userId } = req.params;
        const data = z.object({
            roleId: z.string().optional(),
            isActive: z.boolean().optional(),
            isDefault: z.boolean().optional(),
        }).parse(req.body);

        const result = await tenantMembershipService.updateByUserAndTenant(userId, tenantId, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Remove a member from a tenant
 * DELETE /tenants/:tenantId/members/:userId
 */
tenantMembershipRouter.delete('/tenants/:tenantId/members/:userId', async (req, res, next) => {
    try {
        const { tenantId, userId } = req.params;
        await tenantMembershipService.deleteByUserAndTenant(userId, tenantId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

/**
 * Get all tenants for a user
 * GET /users/:userId/tenants
 */
tenantMembershipRouter.get('/users/:userId/tenants', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const result = await tenantMembershipService.findByUser(userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Get user's default tenant
 * GET /users/:userId/default-tenant
 */
tenantMembershipRouter.get('/users/:userId/default-tenant', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const result = await tenantMembershipService.getDefaultTenant(userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Set user's default tenant
 * PUT /users/:userId/default-tenant/:tenantId
 */
tenantMembershipRouter.put('/users/:userId/default-tenant/:tenantId', async (req, res, next) => {
    try {
        const { userId, tenantId } = req.params;
        const result = await tenantMembershipService.setDefaultTenant(userId, tenantId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});
