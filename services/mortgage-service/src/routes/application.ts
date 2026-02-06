import { Router, Request, Response, NextFunction } from 'express';
import { createApplicationService } from '../services/application.service';
import { applicationPhaseService } from '../services/application-phase.service';
import { applicationPaymentService } from '../services/application-payment.service';
import { createApplicationOrganizationService, isOrgStaffRole } from '../services/application-organization.service';
import {
    ApplicationStatus,
    successResponse,
    getAuthContext,
    requireTenant,
    requireRole,
    isAdmin,
    ADMIN_ROLES,
    ROLES,
} from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import {
    CreateApplicationSchema,
    UpdateApplicationSchema,
    TransitionApplicationSchema,
} from '../validators/application.validator';
import {
    ActivatePhaseSchema,
    CompleteStepSchema,
    UploadDocumentSchema,
    GenerateInstallmentsSchema,
    ApproveDocumentSchema,
    SubmitQuestionnaireSchema,
    GateActionSchema,
    RevertDocumentSchema,
    ReopenPhaseSchema,
} from '../validators/application-phase.validator';
import {
    BindOrganizationSchema,
    UpdateOrganizationBindingSchema,
} from '../validators/application-organization.validator';
import {
    CreatePaymentSchema,
    ProcessPaymentSchema,
    RefundPaymentSchema,
} from '../validators/application-payment.validator';
import { z } from 'zod';
import { getTenantPrisma } from '../lib/tenant-services';
import { AppError } from '@valentine-efagene/qshelter-common';

const router: Router = Router();

/**
 * Helper to get tenant-scoped application service from request
 */
function getApplicationService(req: Request) {
    return createApplicationService(getTenantPrisma(req));
}

/**
 * Helper to get application organization service from request
 */
function getAppOrgService(req: Request) {
    return createApplicationOrganizationService(getTenantPrisma(req));
}

/**
 * Middleware to verify user can access an application.
 * Admins can access any application in their tenant.
 * Customers can only access their own applications.
 * Developers, Lenders, and Legal can only access applications where their
 * organization is bound to the application.
 */
async function canAccessApplication(req: Request, res: Response, next: NextFunction) {
    try {
        const { userId, roles, tenantId } = getAuthContext(req);
        const applicationId = req.params.id as string;

        // Admins can access any application
        if (isAdmin(roles)) {
            return next();
        }

        // For customers, check ownership
        const applicationService = getApplicationService(req);
        const application = await applicationService.findById(applicationId);

        if (application.buyerId === userId) {
            return next();
        }

        // Organization staff (lender_ops, agent, legal, DEVELOPER, LENDER, LEGAL)
        // must be bound to the application via their organization
        if (isOrgStaffRole(roles)) {
            // Check if user's organization is bound to this application
            const appOrgService = getAppOrgService(req);
            const binding = await appOrgService.getUserOrganizationBinding(applicationId, userId);

            if (binding) {
                // Store the binding in request for use by route handlers
                (req as any).organizationBinding = binding;
                return next();
            }

            throw new AppError(403, 'Your organization is not authorized to access this application');
        }

        throw new AppError(403, 'You do not have permission to access this application');
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// APPLICATION ROUTES
// ============================================================================

// Create application from payment method
router.post('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId, userId } = getAuthContext(req);
        console.log('Creating application with body:', JSON.stringify(req.body, null, 2));
        const data = CreateApplicationSchema.parse(req.body);
        // Use userId from header as buyerId if not provided in body
        const applicationData = { ...data, tenantId, buyerId: data.buyerId || userId };
        const applicationService = getApplicationService(req);
        const application = await applicationService.create(applicationData);
        res.status(201).json(successResponse(application));
    } catch (error: any) {
        console.error('Application create error:', error.message);
        if (error instanceof z.ZodError) {
            console.error('Zod validation error paths:', error.issues.map(i => ({ path: i.path.join('.'), message: i.message })));
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all applications
router.get('/', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { buyerId, propertyUnitId, status, page, limit } = req.query;
        const { userId, roles } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const appOrgService = getAppOrgService(req);

        // Build filters
        const filters: any = {
            propertyUnitId: propertyUnitId as string,
            status: status as ApplicationStatus | undefined,
            page: page ? parseInt(page as string, 10) : 1,
            limit: limit ? parseInt(limit as string, 10) : 20,
        };

        if (isAdmin(roles)) {
            // Platform admins can filter by any buyerId and see all applications
            filters.buyerId = buyerId as string;
        } else if (isOrgStaffRole(roles)) {
            // Organization staff (bank lender_ops, agents, legal, etc.)
            // can only see applications where their organization is bound
            const userOrgIds = await appOrgService.getUserOrganizationIds(userId);

            if (userOrgIds.length === 0) {
                // User is not a member of any organization - return empty
                return res.json(successResponse({
                    items: [],
                    pagination: {
                        page: filters.page,
                        limit: filters.limit,
                        total: 0,
                        totalPages: 0,
                    },
                }));
            }

            // Get applications bound to user's organizations
            const boundAppIds = await appOrgService.getApplicationIdsByOrganizations(userOrgIds);

            if (boundAppIds.length === 0) {
                // No applications bound to user's organizations
                return res.json(successResponse({
                    items: [],
                    pagination: {
                        page: filters.page,
                        limit: filters.limit,
                        total: 0,
                        totalPages: 0,
                    },
                }));
            }

            filters.applicationIds = boundAppIds;
            // Staff can also filter by buyerId within their org-bound applications
            if (buyerId) {
                filters.buyerId = buyerId as string;
            }
        } else {
            // Regular customers can only see their own applications
            filters.buyerId = userId;
        }

        const result = await applicationService.findAll(filters);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Get application by ID
router.get('/:id', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicationService = getApplicationService(req);
        const application = await applicationService.findById(req.params.id as string);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Get current action required for an application
// This is the canonical endpoint for the app to know what to show the user
router.get('/:id/current-action', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicationService = getApplicationService(req);
        const { userId, tenantId } = getAuthContext(req);

        // Get user's organization type codes for context-aware action determination
        // This helps determine if user should see UPLOAD vs WAIT vs REVIEW
        const userOrgTypeCodes: string[] = [];

        // Check if user has an organization binding (from canAccessApplication middleware)
        const binding = (req as any).organizationBinding;
        if (binding) {
            // User accessed via organization membership - get org types
            // Note: OrganizationTypeAssignment is NOT tenant-scoped, use base prisma
            const orgTypes = await prisma.organizationTypeAssignment.findMany({
                where: { organizationId: binding.organizationId },
                include: { orgType: true }
            });
            userOrgTypeCodes.push(...orgTypes.map(ot => ot.orgType.code));
        } else {
            // User might be accessing as buyer or admin
            // Fetch their organization memberships
            // Note: OrganizationMember is NOT tenant-scoped, so use base prisma
            // but filter through tenant-scoped organizations
            const memberships = await prisma.organizationMember.findMany({
                where: {
                    userId,
                    organization: {
                        tenantId // Filter by tenant through organization relation
                    }
                },
                include: {
                    organization: {
                        include: {
                            types: {
                                include: { orgType: true }
                            }
                        }
                    }
                }
            });

            for (const membership of memberships) {
                for (const ta of membership.organization.types) {
                    if (!userOrgTypeCodes.includes(ta.orgType.code)) {
                        userOrgTypeCodes.push(ta.orgType.code);
                    }
                }
            }
        }

        const result = await applicationService.getCurrentAction(req.params.id as string, userId, userOrgTypeCodes);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Get application by application number
router.get('/number/:applicationNumber', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const applicationService = getApplicationService(req);
        const application = await applicationService.findByApplicationNumber(req.params.applicationNumber as string);

        // Check access - admins can access any, customers only their own
        const { userId, roles } = getAuthContext(req);
        if (!isAdmin(roles) && application.buyerId !== userId) {
            throw new AppError(403, 'You do not have permission to access this application');
        }

        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Update application
router.patch('/:id', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateApplicationSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const application = await applicationService.update(req.params.id as string, data, userId);
        res.json(successResponse(application));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Transition application state
router.post('/:id/transition', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = TransitionApplicationSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const application = await applicationService.transition(req.params.id as string, data, userId);
        res.json(successResponse(application));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Sign application
router.post('/:id/sign', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const application = await applicationService.sign(req.params.id as string, userId);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Cancel application
router.post('/:id/cancel', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { reason } = req.body;
        const applicationService = getApplicationService(req);
        const application = await applicationService.cancel(req.params.id as string, userId, reason);
        res.json(successResponse(application));
    } catch (error) {
        next(error);
    }
});

// Delete application (draft only)
router.delete('/:id', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const applicationService = getApplicationService(req);
        const result = await applicationService.delete(req.params.id as string, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// ORGANIZATION BINDING ROUTES
// ============================================================================
// These routes manage which organizations (banks, developers, legal firms)
// are authorized to interact with specific applications.

// Bind an organization to an application (admin only)
router.post('/:id/organizations', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = BindOrganizationSchema.parse(req.body);
        const { userId, tenantId } = getAuthContext(req);
        const appOrgService = getAppOrgService(req);
        const binding = await appOrgService.bindOrganization(
            req.params.id as string,
            tenantId as string,
            data,
            userId
        );
        res.status(201).json(successResponse(binding));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get all organization bindings for an application
router.get('/:id/organizations', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appOrgService = getAppOrgService(req);
        const bindings = await appOrgService.getOrganizationBindings(req.params.id as string);
        res.json(successResponse(bindings));
    } catch (error) {
        next(error);
    }
});

// Update an organization binding (admin only)
router.patch('/:id/organizations/:bindingId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UpdateOrganizationBindingSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const appOrgService = getAppOrgService(req);
        const binding = await appOrgService.updateOrganizationBinding(
            req.params.bindingId as string,
            data,
            userId
        );
        res.json(successResponse(binding));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Remove an organization binding (admin only)
router.delete('/:id/organizations/:bindingId', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const appOrgService = getAppOrgService(req);
        const result = await appOrgService.unbindOrganization(req.params.bindingId as string);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// PHASE ROUTES
// ============================================================================

// Get phases for an application
router.get('/:id/phases', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phases = await applicationPhaseService.getPhasesByApplication(req.params.id as string);
        // Flatten payment phase fields for backwards compatibility
        const flattenedPhases = phases.map((phase: any) => ({
            ...phase,
            // Flatten PaymentPhase fields to top level
            totalAmount: phase.paymentPhase?.totalAmount ?? 0,
            paidAmount: phase.paymentPhase?.paidAmount ?? 0,
            interestRate: phase.paymentPhase?.interestRate ?? null,
            collectFunds: phase.paymentPhase?.collectFunds ?? false,
            installments: phase.paymentPhase?.installments ?? [],
            // Flatten DocumentationPhase fields (stageProgress is the actual field name)
            currentStageOrder: phase.documentationPhase?.currentStageOrder ?? null,
            stageProgress: phase.documentationPhase?.stageProgress ?? [],
            // Flatten QuestionnairePhase fields
            fields: phase.questionnairePhase?.fields ?? [],
        }));
        res.json(successResponse(flattenedPhases));
    } catch (error) {
        next(error);
    }
});

// Get phase by ID
router.get('/:id/phases/:phaseId', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phase = await applicationPhaseService.findById(req.params.phaseId as string);
        // Flatten polymorphic fields for backwards compatibility
        const flattenedPhase = {
            ...phase,
            totalAmount: (phase as any).paymentPhase?.totalAmount ?? 0,
            paidAmount: (phase as any).paymentPhase?.paidAmount ?? 0,
            interestRate: (phase as any).paymentPhase?.interestRate ?? null,
            collectFunds: (phase as any).paymentPhase?.collectFunds ?? false,
            installments: (phase as any).paymentPhase?.installments ?? [],
            currentStepId: (phase as any).documentationPhase?.currentStepId ?? null,
            steps: (phase as any).documentationPhase?.steps ?? [],
            fields: (phase as any).questionnairePhase?.fields ?? [],
        };
        res.json(successResponse(flattenedPhase));
    } catch (error) {
        next(error);
    }
});

// Activate phase
router.post('/:id/phases/:phaseId/activate', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ActivatePhaseSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.activate(req.params.phaseId as string, data, userId);
        res.json(successResponse(phase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Submit questionnaire answers for a QUESTIONNAIRE phase
router.post('/:id/phases/:phaseId/questionnaire/submit', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = SubmitQuestionnaireSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const result = await applicationPhaseService.submitQuestionnaire(req.params.phaseId as string, data, userId);
        res.json(successResponse(result));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Review a questionnaire phase (approve/reject) - admin action
// When autoDecisionEnabled is false (default), questionnaire phases require manual review
// after submission. The scoring serves as guidance for the reviewer's decision.
router.post('/:id/phases/:phaseId/questionnaire/review', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { decision, notes } = req.body;

        if (!decision || !['APPROVE', 'REJECT'].includes(decision)) {
            res.status(400).json({
                success: false,
                error: 'Invalid decision. Must be APPROVE or REJECT.'
            });
            return;
        }

        const { userId } = getAuthContext(req);
        const result = await applicationPhaseService.reviewQuestionnairePhase(
            req.params.phaseId as string,
            decision,
            userId,
            notes
        );
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// Generate installments for phase
router.post('/:id/phases/:phaseId/installments', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = GenerateInstallmentsSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.generateInstallments(req.params.phaseId as string, data, userId);
        // Transform installments to include amountDue for backwards compatibility
        // Installments are now on paymentPhase extension
        const installments = phase.paymentPhase?.installments ?? [];
        const responsePhase = {
            ...phase,
            installments: installments.map((inst: any) => ({
                ...inst,
                amountDue: inst.amount,
            })),
        };
        res.json(successResponse(responsePhase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Complete a step in a documentation phase
router.post('/:id/phases/:phaseId/steps/complete', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CompleteStepSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.completeStep(req.params.phaseId as string, data, userId);
        res.json(successResponse(phase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Reject a step in a documentation phase (admin action)
router.post('/:id/phases/:phaseId/steps/:stepId/reject', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ success: false, error: 'Rejection reason is required' });
            return;
        }
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.rejectStep(req.params.phaseId as string, req.params.stepId as string, reason, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Request changes on a step (admin action)
router.post('/:id/phases/:phaseId/steps/:stepId/request-changes', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ success: false, error: 'Change request reason is required' });
            return;
        }
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.requestStepChanges(req.params.phaseId as string, req.params.stepId as string, reason, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Perform a gate action (approve/reject/acknowledge) on a GATE step
router.post('/:id/phases/:phaseId/steps/:stepId/gate', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = GateActionSchema.parse(req.body);
        const { userId, roles } = getAuthContext(req);
        const phase = await applicationPhaseService.performGateAction(
            req.params.phaseId as string,
            req.params.stepId as string,
            data,
            userId,
            roles || []
        );
        res.json(successResponse(phase));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get documents for a phase
router.get('/:id/phases/:phaseId/documents', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const documents = await applicationPhaseService.getDocumentsByPhase(req.params.phaseId as string);
        res.json(successResponse(documents));
    } catch (error) {
        next(error);
    }
});

// Get installments for a phase
router.get('/:id/phases/:phaseId/installments', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = req.query.status as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
        const installments = await applicationPhaseService.getInstallmentsByPhase(req.params.phaseId as string, { status, limit });
        res.json(successResponse(installments));
    } catch (error) {
        next(error);
    }
});

// Upload document for phase
router.post('/:id/phases/:phaseId/documents', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = UploadDocumentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const document = await applicationPhaseService.uploadDocument(req.params.phaseId as string, data, userId);
        res.status(201).json(successResponse(document));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Review/approve a document (stage-based approval)
// Allows organization members to review documents at their designated stage
router.post('/:id/documents/:documentId/review', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ApproveDocumentSchema.parse(req.body);
        const { userId, tenantId, roles } = getAuthContext(req);

        // Map status to ReviewDecision
        const decisionMap: Record<string, string> = {
            'APPROVED': 'APPROVED',
            'REJECTED': 'REJECTED',
            'CHANGES_REQUESTED': 'CHANGES_REQUESTED',
        };
        const decision = decisionMap[data.status] || 'REJECTED';

        // Look up the document to get the phaseId
        const document = await prisma.applicationDocument.findFirst({
            where: {
                id: req.params.documentId as string,
                tenantId,
                applicationId: req.params.id as string,
            },
        });

        if (!document || !document.phaseId) {
            res.status(404).json({ success: false, error: 'Document not found or not linked to a phase' });
            return;
        }

        // Resolve organization type code to ID
        // Default to 'PLATFORM' for admins if not specified
        let organizationTypeId: string;
        const orgTypeCode = data.organizationTypeCode || (isAdmin(roles) ? 'PLATFORM' : null);

        if (!orgTypeCode) {
            res.status(400).json({
                success: false,
                error: 'organizationTypeCode is required for non-admin reviewers'
            });
            return;
        }

        const orgType = await prisma.organizationType.findUnique({
            where: { tenantId_code: { tenantId: tenantId as string, code: orgTypeCode } },
        });

        if (!orgType) {
            res.status(400).json({
                success: false,
                error: `Organization type '${orgTypeCode}' not found`
            });
            return;
        }
        organizationTypeId = orgType.id;

        const result = await applicationPhaseService.reviewDocument(
            document.phaseId,
            req.params.documentId as string,
            decision as any,
            organizationTypeId,
            userId,
            data.comment
        );
        res.json(successResponse(result));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Revert document approval - return to PENDING state (admin only)
// Allows undoing a document approval, returning it to pending for re-review
router.post('/:id/documents/:documentId/revert', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = RevertDocumentSchema.parse(req.body);
        const { userId, tenantId, roles } = getAuthContext(req);

        // Look up the document to get the phaseId
        const document = await prisma.applicationDocument.findFirst({
            where: {
                id: req.params.documentId as string,
                tenantId,
                applicationId: req.params.id as string,
            },
        });

        if (!document || !document.phaseId) {
            res.status(404).json({ success: false, error: 'Document not found or not linked to a phase' });
            return;
        }

        // Resolve organization type code to ID (default to PLATFORM for admins)
        const orgTypeCode = data.organizationTypeCode || 'PLATFORM';
        const orgType = await prisma.organizationType.findUnique({
            where: { tenantId_code: { tenantId: tenantId as string, code: orgTypeCode } },
        });

        if (!orgType) {
            res.status(400).json({
                success: false,
                error: `Organization type '${orgTypeCode}' not found`
            });
            return;
        }

        const result = await applicationPhaseService.revertDocumentApproval(
            document.phaseId,
            req.params.documentId as string,
            orgType.id,
            userId,
            data.reason
        );
        res.json(successResponse(result));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Reopen a completed phase (admin only)
// Allows reopening a completed phase to make corrections
router.post('/:id/phases/:phaseId/reopen', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ReopenPhaseSchema.parse(req.body);
        const { userId } = getAuthContext(req);

        const result = await applicationPhaseService.reopenPhase(
            req.params.phaseId as string,
            userId,
            data.reason,
            data.resetDependentPhases
        );
        res.json(successResponse(result));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Complete phase
router.post('/:id/phases/:phaseId/complete', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const phase = await applicationPhaseService.complete(req.params.phaseId as string, userId);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// Skip phase (admin only)
router.post('/:id/phases/:phaseId/skip', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = getAuthContext(req);
        const { reason } = req.body;
        const phase = await applicationPhaseService.skip(req.params.phaseId as string, userId, reason);
        res.json(successResponse(phase));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// PAYMENT ROUTES
// ============================================================================

// Create payment
router.post('/:id/payments', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = CreatePaymentSchema.parse({
            ...req.body,
            applicationId: req.params.id as string,
        });
        const { userId } = getAuthContext(req);
        const payment = await applicationPaymentService.create(data, userId);
        res.status(201).json(successResponse(payment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get payments for application
router.get('/:id/payments', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payments = await applicationPaymentService.findByApplication(req.params.id as string);
        res.json(successResponse(payments));
    } catch (error) {
        next(error);
    }
});

// Get payment by ID
router.get('/:id/payments/:paymentId', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const payment = await applicationPaymentService.findById(req.params.paymentId as string);
        res.json(successResponse(payment));
    } catch (error) {
        next(error);
    }
});

// Process payment (webhook callback)
router.post('/payments/process', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = ProcessPaymentSchema.parse(req.body);
        const payment = await applicationPaymentService.process(data);
        res.json(successResponse(payment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Refund payment (admin only)
router.post('/:id/payments/:paymentId/refund', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = RefundPaymentSchema.parse(req.body);
        const { userId } = getAuthContext(req);
        const payment = await applicationPaymentService.refund(req.params.paymentId as string, data, userId);
        res.json(successResponse(payment));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Pay ahead (apply excess to future installments)
router.post('/:id/pay-ahead', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { amount } = req.body;
        if (typeof amount !== 'number' || amount <= 0) {
            res.status(400).json({ success: false, error: 'amount must be a positive number' });
            return;
        }
        const { userId } = getAuthContext(req);
        const result = await applicationPaymentService.payAhead(req.params.id as string, amount, userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// MULTI-PARTY DOCUMENT REVIEW ROUTES
// ============================================================================

// Get all reviews for a document
router.get('/:id/documents/:documentId/reviews', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { createDocumentReviewService } = await import('../services/document-review.service');
        const documentReviewService = createDocumentReviewService(getTenantPrisma(req));
        const summary = await documentReviewService.getReviewSummary(req.params.documentId as string);
        res.json(successResponse(summary));
    } catch (error) {
        next(error);
    }
});

// Submit a document review (multi-party)
router.post('/:id/documents/:documentId/reviews', requireTenant, canAccessApplication, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { SubmitDocumentReviewSchema } = await import('../validators/document-review.validator');
        const { createDocumentReviewService } = await import('../services/document-review.service');

        const data = SubmitDocumentReviewSchema.parse(req.body);
        const { userId, tenantId } = getAuthContext(req);
        const documentReviewService = createDocumentReviewService(getTenantPrisma(req));

        const result = await documentReviewService.submitReview(
            {
                documentId: req.params.documentId as string,
                organizationTypeCode: data.organizationTypeCode,
                decision: data.decision,
                comments: data.comments,
                concerns: data.concerns,
                organizationId: data.organizationId,
            },
            userId,
            tenantId as string
        );

        if (!result.success) {
            res.status(400).json({ success: false, error: result.error });
            return;
        }

        res.json(successResponse(result.review));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Waive a review requirement (admin only)
router.post('/:id/documents/:documentId/reviews/waive', requireTenant, requireRole(ADMIN_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { WaiveReviewSchema } = await import('../validators/document-review.validator');
        const { createDocumentReviewService } = await import('../services/document-review.service');

        const data = WaiveReviewSchema.parse(req.body);
        const { userId, tenantId } = getAuthContext(req);
        const documentReviewService = createDocumentReviewService(getTenantPrisma(req));

        const review = await documentReviewService.waiveReview(
            req.params.documentId as string,
            tenantId as string,
            data.organizationTypeCode,
            data.organizationId ?? null,
            userId,
            data.reason
        );

        res.json(successResponse(review));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

// Get documents pending review for a party (dashboard endpoint)
router.get('/reviews/pending', requireTenant, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { GetPendingReviewsQuerySchema } = await import('../validators/document-review.validator');
        const { createDocumentReviewService } = await import('../services/document-review.service');

        const query = GetPendingReviewsQuerySchema.parse(req.query);
        const { tenantId } = getAuthContext(req);
        const documentReviewService = createDocumentReviewService(getTenantPrisma(req));

        const result = await documentReviewService.getDocumentsPendingReview(tenantId, query.organizationTypeCode, {
            organizationId: query.organizationId,
            applicationId: query.applicationId,
            limit: query.limit,
            offset: query.offset,
        });

        res.json(successResponse(result));
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
            return;
        }
        next(error);
    }
});

export default router;
