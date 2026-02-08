import { Router, type Router as RouterType } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { unitService } from '../services/unit.service';
import { createUnitSchema, updateUnitSchema, bulkCreateUnitsSchema } from '../validators/unit.validator';

export const unitRouter: RouterType = Router();

// Bulk create units for a variant
unitRouter.post('/properties/:propertyId/variants/:variantId/units/bulk', async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const data = bulkCreateUnitsSchema.parse(req.body);
        const units = await unitService.bulkCreateUnits(variantId, data, tenantId);
        res.status(201).json(successResponse(units));
    } catch (error) {
        next(error);
    }
});

// Create unit for a variant
unitRouter.post('/properties/:propertyId/variants/:variantId/units', async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const data = createUnitSchema.parse(req.body);
        const unit = await unitService.createUnit(variantId, data, tenantId);
        res.status(201).json(successResponse(unit));
    } catch (error) {
        next(error);
    }
});

// List units for a variant
unitRouter.get('/properties/:propertyId/variants/:variantId/units', async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const status = req.query.status as string | undefined;
        const units = await unitService.getUnits(variantId, tenantId, { status });
        res.json(successResponse(units));
    } catch (error) {
        next(error);
    }
});

// Get single unit
unitRouter.get('/units/:unitId', async (req, res, next) => {
    try {
        const { unitId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const unit = await unitService.getUnitById(unitId, tenantId);
        res.json(successResponse(unit));
    } catch (error) {
        next(error);
    }
});

// Update unit
unitRouter.put('/units/:unitId', async (req, res, next) => {
    try {
        const { unitId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const data = updateUnitSchema.parse(req.body);
        const unit = await unitService.updateUnit(unitId, data, tenantId);
        res.json(successResponse(unit));
    } catch (error) {
        next(error);
    }
});

// Delete unit
unitRouter.delete('/units/:unitId', async (req, res, next) => {
    try {
        const { unitId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const result = await unitService.deleteUnit(unitId, tenantId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});
