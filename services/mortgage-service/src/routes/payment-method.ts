import { Router, Request, Response, NextFunction } from 'express';
import { createPaymentMethodService } from '../services/payment-method.service';
import {
    CreatePaymentMethodSchema,
    UpdatePaymentMethodSchema,
    AddPhaseSchema,
    PartialPhaseSchema,
    LinkToPropertySchema,
    AddStepSchema,
    UpdateStepSchema,
    ReorderStepsSchema,
    AddDocumentRequirementSchema,
    UpdateDocumentRequirementSchema,
    ClonePaymentMethodSchema,
    AddPhaseEventAttachmentSchema,
    UpdatePhaseEventAttachmentSchema,
    AddStepEventAttachmentSchema,
    UpdateStepEventAttachmentSchema,
    BulkDocumentRulesSchema,
} from '../validators/payment-method.validator';
import { z } from 'zod';
import {
    getAuthContext,
    successResponse,
    requireTenant,
    requireRole,
    ADMIN_ROLES,
} from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import { getTenantPrisma } from '../lib/tenant-services';

const router = Router();

/**
 * Helper to get tenant-scoped payment method service from request
 */
function getPaymentMethodService(req: Request) {
    return createPaymentMethodService(getTenantPrisma(req));
}

// Create payment method (admin only)
router.post('/', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = CreatePaymentMethodSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const method = await paymentMethodService.create(tenantId, data);
        res.status(201).json(successResponse(method));
    } catch (error: any) {
        console.error('Payment method create error:', error.message, error.statusCode || error.code);
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all payment methods (public - customers need to see available methods)
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const paymentMethodService = getPaymentMethodService(req);
        const methods = await paymentMethodService.findAll({ isActive });
        res.json(successResponse(methods));
    } catch (error) {
        next(error);
    }
});

// Get payment method by ID
router.get('/:id', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const method = await paymentMethodService.findById(req.params.id);
        res.json(successResponse(method));
    } catch (error) {
        next(error);
    }
});

// Update payment method (admin only)
router.patch('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdatePaymentMethodSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const method = await paymentMethodService.update(req.params.id, data);
        res.json(successResponse(method));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete payment method (admin only)
router.delete('/:id', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const result = await paymentMethodService.delete(req.params.id);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Add phase to payment method (admin only)
router.post('/:id/phases', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddPhaseSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const phase = await paymentMethodService.addPhase(req.params.id, data);
        res.status(201).json(successResponse(phase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update phase (admin only)
router.patch('/:id/phases/:phaseId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = PartialPhaseSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const phase = await paymentMethodService.updatePhase(req.params.phaseId, data);
        res.json(successResponse(phase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete phase (admin only)
router.delete('/:id/phases/:phaseId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const result = await paymentMethodService.deletePhase(req.params.phaseId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Reorder phases (admin only)
router.post('/:id/phases/reorder', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phaseOrders } = req.body;
        if (!Array.isArray(phaseOrders)) {
            res.status(400).json({ success: false, error: 'phaseOrders array is required' });
            return;
        }
        const paymentMethodService = getPaymentMethodService(req);
        const method = await paymentMethodService.reorderPhases(req.params.id, phaseOrders);
        res.json(successResponse(method));
    } catch (error) {
        next(error);
    }
});

// ============================================================
// Clone Template
// ============================================================

// Clone a payment method (admin only)
router.post('/:id/clone', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const data = ClonePaymentMethodSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const cloned = await paymentMethodService.clone(req.params.id, tenantId, data);
        res.status(201).json(successResponse(cloned));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// ============================================================
// Step CRUD within a Phase (admin only)
// ============================================================

// Add step to phase (admin only)
router.post('/:id/phases/:phaseId/steps', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddStepSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const step = await paymentMethodService.addStep(req.params.phaseId, data);
        res.status(201).json(successResponse(step));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update step (admin only)
router.patch('/:id/phases/:phaseId/steps/:stepId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateStepSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const step = await paymentMethodService.updateStep(req.params.stepId, data);
        res.json(successResponse(step));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete step (admin only)
router.delete('/:id/phases/:phaseId/steps/:stepId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const result = await paymentMethodService.deleteStep(req.params.stepId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Reorder steps within a phase (admin only)
router.post('/:id/phases/:phaseId/steps/reorder', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ReorderStepsSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const steps = await paymentMethodService.reorderSteps(req.params.phaseId, data.stepOrders);
        res.json(successResponse(steps));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// ============================================================
// Document Requirement CRUD within a Phase (admin only)
// ============================================================

// Add document requirement to phase (admin only)
router.post('/:id/phases/:phaseId/documents', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddDocumentRequirementSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const doc = await paymentMethodService.addDocumentRequirement(req.params.phaseId, data);
        res.status(201).json(successResponse(doc));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Update document requirement (admin only)
router.patch('/:id/phases/:phaseId/documents/:documentId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateDocumentRequirementSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const doc = await paymentMethodService.updateDocumentRequirement(req.params.documentId, data);
        res.json(successResponse(doc));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete document requirement (admin only)
router.delete('/:id/phases/:phaseId/documents/:documentId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const result = await paymentMethodService.deleteDocumentRequirement(req.params.documentId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Link to property (admin only)
router.post('/:id/properties', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = LinkToPropertySchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const link = await paymentMethodService.linkToProperty(req.params.id, data);
        res.status(201).json(successResponse(link));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Unlink from property (admin only)
router.delete('/:id/properties/:propertyId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const result = await paymentMethodService.unlinkFromProperty(req.params.id, req.params.propertyId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Get payment methods for a property (public)
router.get('/property/:propertyId', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const methods = await paymentMethodService.getMethodsForProperty(req.params.propertyId);
        res.json(successResponse(methods));
    } catch (error) {
        next(error);
    }
});

// ============================================================
// Phase Event Attachment CRUD (admin only)
// ============================================================

// Add event attachment to phase (admin only)
router.post('/:id/phases/:phaseId/event-attachments', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddPhaseEventAttachmentSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const attachment = await paymentMethodService.addPhaseEventAttachment(req.params.phaseId, data);
        res.status(201).json(successResponse(attachment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get event attachments for a phase
router.get('/:id/phases/:phaseId/event-attachments', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const attachments = await paymentMethodService.getPhaseEventAttachments(req.params.phaseId);
        res.json(successResponse(attachments));
    } catch (error) {
        next(error);
    }
});

// Update phase event attachment (admin only)
router.patch('/phase-event-attachments/:attachmentId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdatePhaseEventAttachmentSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const attachment = await paymentMethodService.updatePhaseEventAttachment(req.params.attachmentId, data);
        res.json(successResponse(attachment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete phase event attachment (admin only)
router.delete('/phase-event-attachments/:attachmentId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const result = await paymentMethodService.deletePhaseEventAttachment(req.params.attachmentId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// ============================================================
// Step Event Attachment CRUD (admin only)
// ============================================================

// Add event attachment to step (admin only)
router.post('/:id/phases/:phaseId/steps/:stepId/event-attachments', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = AddStepEventAttachmentSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const attachment = await paymentMethodService.addStepEventAttachment(req.params.stepId, data);
        res.status(201).json(successResponse(attachment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get event attachments for a step
router.get('/:id/phases/:phaseId/steps/:stepId/event-attachments', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const attachments = await paymentMethodService.getStepEventAttachments(req.params.stepId);
        res.json(successResponse(attachments));
    } catch (error) {
        next(error);
    }
});

// Update step event attachment (admin only)
router.patch('/step-event-attachments/:attachmentId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateStepEventAttachmentSchema.parse(req.body);
        const paymentMethodService = getPaymentMethodService(req);
        const attachment = await paymentMethodService.updateStepEventAttachment(req.params.attachmentId, data);
        res.json(successResponse(attachment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Delete step event attachment (admin only)
router.delete('/step-event-attachments/:attachmentId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodService = getPaymentMethodService(req);
        const result = await paymentMethodService.deleteStepEventAttachment(req.params.attachmentId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// ============================================================
// Document Requirement Rules (Bulk Operations) - admin only
// ============================================================

// Create document requirement rules for a payment method (admin only)
router.post('/:id/document-rules', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId } = getAuthContext(req);
        const paymentMethodId = req.params.id;
        const data = BulkDocumentRulesSchema.parse(req.body);

        // The tenant-scoped prisma will automatically filter by tenant
        const tenantPrisma = getTenantPrisma(req);

        // Verify payment method exists (tenant scoping handled by wrapper)
        const paymentMethod = await tenantPrisma.propertyPaymentMethod.findUnique({
            where: { id: paymentMethodId },
        });

        if (!paymentMethod) {
            res.status(404).json({ error: 'Payment method not found' });
            return;
        }

        // Create rules in a transaction
        const createdRules = await prisma.$transaction(async (tx) => {
            const rules = [];
            for (const rule of data.rules) {
                const created = await tx.documentRequirementRule.create({
                    data: {
                        tenantId,
                        paymentMethodId,
                        context: rule.context as any,
                        phaseType: rule.phaseType,
                        documentType: rule.documentType,
                        isRequired: rule.isRequired,
                        description: rule.description,
                        maxSizeBytes: rule.maxSizeBytes,
                        allowedMimeTypes: rule.allowedMimeTypes?.join(','),
                        expiryDays: rule.expiryDays,
                        requiresManualReview: rule.requiresManualReview,
                    },
                });
                rules.push(created);
            }
            return rules;
        });

        res.status(201).json({ success: true, data: createdRules });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get document requirement rules for a payment method
router.get('/:id/document-rules', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const paymentMethodId = req.params.id;
        const phaseType = req.query.phaseType as string | undefined;

        const tenantPrisma = getTenantPrisma(req);

        // Verify payment method exists (tenant scoping handled by wrapper)
        const paymentMethod = await tenantPrisma.propertyPaymentMethod.findUnique({
            where: { id: paymentMethodId },
        });

        if (!paymentMethod) {
            res.status(404).json({ error: 'Payment method not found' });
            return;
        }

        const rules = await tenantPrisma.documentRequirementRule.findMany({
            where: {
                paymentMethodId,
                ...(phaseType ? { phaseType } : {}),
            },
            orderBy: [{ phaseType: 'asc' }, { documentType: 'asc' }],
        });

        // Transform allowedMimeTypes back to array
        const transformedRules = rules.map((rule: any) => ({
            ...rule,
            allowedMimeTypes: rule.allowedMimeTypes ? rule.allowedMimeTypes.split(',') : [],
        }));

        res.json({ success: true, data: transformedRules });
    } catch (error) {
        next(error);
    }
});

// Delete a document requirement rule (admin only)
router.delete('/:id/document-rules/:ruleId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ruleId } = req.params;

        const tenantPrisma = getTenantPrisma(req);

        // Verify rule exists (tenant scoping handled by wrapper)
        const rule = await tenantPrisma.documentRequirementRule.findUnique({
            where: { id: ruleId },
        });

        if (!rule) {
            res.status(404).json({ error: 'Document rule not found' });
            return;
        }

        await tenantPrisma.documentRequirementRule.delete({
            where: { id: ruleId },
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

export default router;
