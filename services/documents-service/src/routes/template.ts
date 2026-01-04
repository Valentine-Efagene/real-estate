import { Router, Request, Response, NextFunction } from 'express';
import { templateService } from '../services/template.service';
import {
    CreateTemplateSchema,
    UpdateTemplateSchema,
    GenerateDocumentSchema,
    ListTemplatesSchema,
    CreateTemplateVersionSchema,
} from '../validators/template.validator';
import { z } from 'zod';

const router = Router();

// ============================================================================
// TEMPLATE MANAGEMENT ROUTES (Admin)
// ============================================================================

/**
 * Create a new template
 * POST /templates
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing tenant context' });
        }

        const data = CreateTemplateSchema.parse(req.body);
        const template = await templateService.create(data, tenantId);
        res.status(201).json(template);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * List all templates
 * GET /templates
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing tenant context' });
        }

        const filters = ListTemplatesSchema.parse(req.query);
        const templates = await templateService.findAll(filters, tenantId);
        res.json(templates);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Get template by ID
 * GET /templates/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const template = await templateService.findById(req.params.id);
        res.json(template);
    } catch (error) {
        next(error);
    }
});

/**
 * Get template by code
 * GET /templates/code/:code
 */
router.get('/code/:code', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.headers['x-tenant-id'] as string;
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing tenant context' });
        }

        const version = req.query.version ? parseInt(req.query.version as string) : undefined;
        const template = await templateService.findByCode(req.params.code, tenantId, version);
        res.json(template);
    } catch (error) {
        next(error);
    }
});

/**
 * Update template
 * PATCH /templates/:id
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateTemplateSchema.parse(req.body);
        const template = await templateService.update(req.params.id, data);
        res.json(template);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Create new version of template
 * POST /templates/:id/versions
 */
router.post('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CreateTemplateVersionSchema.parse(req.body);
        const template = await templateService.createVersion(req.params.id, data);
        res.status(201).json(template);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

/**
 * Delete template (soft delete)
 * DELETE /templates/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await templateService.delete(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * Validate template syntax
 * POST /templates/validate
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { htmlTemplate } = req.body;
        if (!htmlTemplate) {
            return res.status(400).json({ error: 'htmlTemplate is required' });
        }

        const result = templateService.validateTemplate(htmlTemplate);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

/**
 * Extract merge fields from template
 * POST /templates/extract-fields
 */
router.post('/extract-fields', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { htmlTemplate } = req.body;
        if (!htmlTemplate) {
            return res.status(400).json({ error: 'htmlTemplate is required' });
        }

        const fields = templateService.extractMergeFields(htmlTemplate);
        res.json({ fields });
    } catch (error) {
        next(error);
    }
});

export default router;
