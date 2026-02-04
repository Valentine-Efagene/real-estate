import { Router } from 'express';
import {
    successResponse,
    getAuthContext,
    hasAnyRole,
    ADMIN_ROLES,
    OrganizationStatus,
} from '@valentine-efagene/qshelter-common';
import { organizationService } from '../services/organization.service';
import { z } from 'zod';

export const organizationRouter = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateOrganizationSchema = z.object({
    name: z.string().min(2).max(200),
    // Array of organization type codes (e.g., ['PLATFORM', 'DEVELOPER'])
    typeCodes: z.array(z.string()).min(1, 'At least one organization type is required'),
    // The primary type code (must be in typeCodes)
    primaryTypeCode: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    website: z.string().url().optional(),
    description: z.string().optional(),
    // Bank-specific
    bankCode: z.string().optional(),
    bankLicenseNo: z.string().optional(),
    swiftCode: z.string().optional(),
    sortCode: z.string().optional(),
    // Developer-specific
    cacNumber: z.string().optional(),
    taxId: z.string().optional(),
});

const UpdateOrganizationSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    website: z.string().url().optional(),
    description: z.string().optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
    // Bank-specific
    bankCode: z.string().optional(),
    bankLicenseNo: z.string().optional(),
    swiftCode: z.string().optional(),
    sortCode: z.string().optional(),
    // Developer-specific
    cacNumber: z.string().optional(),
    taxId: z.string().optional(),
});

const AddMemberSchema = z.object({
    userId: z.string().min(1),
    roleId: z.string().optional(),
    title: z.string().optional(),
    department: z.string().optional(),
    employeeId: z.string().optional(),
});

const UpdateMemberSchema = z.object({
    title: z.string().optional(),
    department: z.string().optional(),
    employeeId: z.string().optional(),
    isActive: z.boolean().optional(),
});

// =============================================================================
// ORGANIZATION ROUTES
// =============================================================================

/**
 * Create a new organization.
 * POST /organizations
 * Admin only.
 */
organizationRouter.post('/', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const data = CreateOrganizationSchema.parse(req.body);
        const result = await organizationService.create(ctx.tenantId, data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * List organizations with filtering.
 * GET /organizations
 */
organizationRouter.get('/', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);

        const params = {
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            sortBy: req.query.sortBy as string | undefined,
            sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
            typeCode: req.query.typeCode as string | undefined,
            status: req.query.status as OrganizationStatus | undefined,
            search: req.query.search as string | undefined,
        };

        const result = await organizationService.findAll(ctx.tenantId, params);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Get organization by ID.
 * GET /organizations/:id
 */
organizationRouter.get('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const result = await organizationService.findById(ctx.tenantId, req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Update organization.
 * PATCH /organizations/:id
 * Admin only.
 */
organizationRouter.patch('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const data = UpdateOrganizationSchema.parse(req.body);
        const result = await organizationService.update(ctx.tenantId, req.params.id, data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Delete organization (soft delete).
 * DELETE /organizations/:id
 * Admin only.
 */
organizationRouter.delete('/:id', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const result = await organizationService.delete(ctx.tenantId, req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// MEMBER ROUTES
// =============================================================================

/**
 * Add a member to an organization.
 * POST /organizations/:id/members
 * Admin only.
 */
organizationRouter.post('/:id/members', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const data = AddMemberSchema.parse(req.body);
        const result = await organizationService.addMember(ctx.tenantId, req.params.id, data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Get organization members.
 * GET /organizations/:id/members
 */
organizationRouter.get('/:id/members', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        const result = await organizationService.getMembers(ctx.tenantId, req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Update a member.
 * PATCH /organizations/:orgId/members/:memberId
 * Admin only.
 */
organizationRouter.patch('/:orgId/members/:memberId', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const data = UpdateMemberSchema.parse(req.body);
        const result = await organizationService.updateMember(
            ctx.tenantId,
            req.params.orgId,
            req.params.memberId,
            data
        );
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * Remove a member from an organization.
 * DELETE /organizations/:orgId/members/:memberId
 * Admin only.
 */
organizationRouter.delete('/:orgId/members/:memberId', async (req, res, next) => {
    try {
        const ctx = getAuthContext(req);
        if (!hasAnyRole(ctx.roles, ADMIN_ROLES)) {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const result = await organizationService.removeMember(
            ctx.tenantId,
            req.params.orgId,
            req.params.memberId
        );
        res.json(successResponse({ message: 'Member removed successfully', member: result }));
    } catch (error) {
        next(error);
    }
});
