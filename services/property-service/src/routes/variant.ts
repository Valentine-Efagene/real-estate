import { Router, type Router as RouterType } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { variantService } from '../services/variant.service';
import { createVariantSchema, updateVariantSchema } from '../validators/variant.validator';

export const variantRouter: RouterType = Router();

// Create variant for a property
variantRouter.post('/properties/:propertyId/variants', async (req, res, next) => {
    try {
        const { propertyId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const data = createVariantSchema.parse(req.body);
        const variant = await variantService.createVariant(propertyId, data, tenantId);
        res.status(201).json(successResponse(variant));
    } catch (error) {
        next(error);
    }
});

// List variants for a property
variantRouter.get('/properties/:propertyId/variants', async (req, res, next) => {
    try {
        const { propertyId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const variants = await variantService.getVariants(propertyId, tenantId);
        res.json(successResponse(variants));
    } catch (error) {
        next(error);
    }
});

// Get single variant
variantRouter.get('/variants/:variantId', async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const variant = await variantService.getVariantById(variantId, tenantId);
        res.json(successResponse(variant));
    } catch (error) {
        next(error);
    }
});

// Update variant
variantRouter.put('/properties/:propertyId/variants/:variantId', async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const data = updateVariantSchema.parse(req.body);
        const variant = await variantService.updateVariant(variantId, data, tenantId);
        res.json(successResponse(variant));
    } catch (error) {
        next(error);
    }
});

// Delete variant
variantRouter.delete('/properties/:propertyId/variants/:variantId', async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const tenantId = req.tenantContext?.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant context required' });
        }

        const result = await variantService.deleteVariant(variantId, tenantId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});
