import { Router, Request, Response } from 'express';
import {
    successResponse,
    getAuthContext,
    requireTenant,
    requireRole,
    ROLES,
    AppError,
    ReviewDecision,
} from '@valentine-efagene/qshelter-common';
import { getTenantPrisma } from '../lib/tenant-services';
import { z } from 'zod';

const router: Router = Router();

// =============================================================================
// ORGANIZATION PENDING REVIEWS
// =============================================================================
// Banks, developers, legal firms, etc. need to see what's waiting for their review.
// This is a core feature - not optional event-based.
// =============================================================================

/**
 * Organization types that participate in document reviews
 * Uses OrganizationType.code values from the database
 */
const REVIEW_ORG_TYPES = ['PLATFORM', 'BANK', 'DEVELOPER', 'LEGAL', 'INSURER', 'GOVERNMENT'];

/**
 * Helper to get the primary type code of an organization.
 * Organizations can have multiple types - this returns the primary one.
 */
async function getPrimaryTypeCode(
    tenantPrisma: ReturnType<typeof getTenantPrisma>,
    organizationId: string
): Promise<string | null> {
    const org = await tenantPrisma.organization.findUnique({
        where: { id: organizationId },
        include: {
            types: {
                where: { isPrimary: true },
                include: { orgType: { select: { code: true } } },
                take: 1,
            },
        },
    });
    return org?.types[0]?.orgType?.code ?? null;
}

/**
 * Helper to check if an organization has a specific type.
 */
async function hasOrgType(
    tenantPrisma: ReturnType<typeof getTenantPrisma>,
    organizationId: string,
    typeCode: string
): Promise<boolean> {
    const assignment = await tenantPrisma.organizationTypeAssignment.findFirst({
        where: {
            organizationId,
            orgType: { code: typeCode },
        },
    });
    return assignment !== null;
}

/**
 * GET /organizations/:orgId/pending-reviews
 * 
 * Returns all applications/documents awaiting review by this organization.
 * Used by banks to see their pending mortgage reviews, developers to see
 * pending document uploads, etc.
 */
router.get(
    '/organizations/:orgId/pending-reviews',
    requireTenant,
    requireRole([ROLES.LENDER, ROLES.DEVELOPER, ROLES.LEGAL, ...Object.values(ROLES).filter(r => r.includes('ADMIN'))]),
    async (req: Request, res: Response) => {
        const { tenantId, userId, roles } = getAuthContext(req);
        const { orgId } = req.params;
        const tenantPrisma = getTenantPrisma(req);

        // Verify user belongs to this organization (or is admin)
        const isAdmin = roles?.some(r => r.includes('ADMIN'));
        if (!isAdmin) {
            const membership = await tenantPrisma.organizationMember.findFirst({
                where: {
                    organizationId: orgId as string,
                    userId,
                },
            });
            if (!membership) {
                throw new AppError(403, 'You are not a member of this organization');
            }
        }

        // Get organization details with its types
        const organization = await tenantPrisma.organization.findUnique({
            where: { id: orgId as string },
            include: {
                types: {
                    include: {
                        orgType: { select: { id: true, code: true, name: true } },
                    },
                },
            },
        });

        if (!organization) {
            throw new AppError(404, 'Organization not found');
        }

        // Get organization type codes
        const orgWithTypes = organization as typeof organization & { types: Array<{ isPrimary: boolean; orgType: { code: string } }> };
        const orgTypeCodes = orgWithTypes.types.map(t => t.orgType.code);
        const primaryTypeCode = orgWithTypes.types.find(t => t.isPrimary)?.orgType?.code || orgTypeCodes[0];

        // Check if any of this organization's types participate in reviews
        const participatingTypes = orgTypeCodes.filter((code: string) => REVIEW_ORG_TYPES.includes(code));
        if (participatingTypes.length === 0) {
            return res.json(successResponse({
                organization: {
                    id: organization.id,
                    name: organization.name,
                    types: orgTypeCodes,
                },
                pendingReviews: [],
                message: 'This organization type does not participate in document reviews',
            }));
        }

        // Look up the OrganizationType records for this organization's types
        const orgTypes = await tenantPrisma.organizationType.findMany({
            where: {
                tenantId,
                code: { in: participatingTypes },
            },
        });

        if (orgTypes.length === 0) {
            return res.json(successResponse({
                organization: {
                    id: organization.id,
                    name: organization.name,
                    types: orgTypeCodes,
                },
                pendingReviews: [],
                message: 'Organization type not configured for this tenant',
            }));
        }

        const orgTypeIds = orgTypes.map(t => t.id);

        // Find applications where this organization is bound
        const applicationBindings = await tenantPrisma.applicationOrganization.findMany({
            where: {
                organizationId: orgId as string,
                status: { in: ['PENDING', 'ACTIVE'] },
            },
            include: {
                application: {
                    include: {
                        buyer: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                        propertyUnit: {
                            include: {
                                variant: {
                                    include: {
                                        property: {
                                            select: {
                                                id: true,
                                                title: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // For each application, find stages where this org is reviewer and status is IN_PROGRESS
        const pendingReviews = [];

        for (const binding of applicationBindings) {
            // Find approval stages in progress for any of this organization's types
            const stages = await tenantPrisma.approvalStageProgress.findMany({
                where: {
                    documentationPhase: {
                        phase: {
                            applicationId: binding.applicationId,
                        },
                    },
                    organizationTypeId: { in: orgTypeIds },
                    status: 'IN_PROGRESS',
                },
                include: {
                    documentationPhase: {
                        include: {
                            phase: true,
                        },
                    },
                    organizationType: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                        },
                    },
                    documentApprovals: {
                        include: {
                            document: true,
                        },
                        where: {
                            decision: 'PENDING',
                        },
                    },
                },
            });

            for (const stage of stages) {
                // Get pending documents for this stage
                const pendingDocs = await tenantPrisma.applicationDocument.findMany({
                    where: {
                        applicationId: binding.applicationId,
                        phaseId: stage.documentationPhase.phaseId,
                        status: 'PENDING',
                    },
                    select: {
                        id: true,
                        documentType: true,
                        name: true,
                        createdAt: true,
                        status: true,
                    },
                });

                const app = (binding as any).application;
                pendingReviews.push({
                    applicationId: binding.applicationId,
                    applicationNumber: app.applicationNumber,
                    customer: {
                        id: app.buyer.id,
                        name: `${app.buyer.firstName || ''} ${app.buyer.lastName || ''}`.trim(),
                        email: app.buyer.email,
                    },
                    property: {
                        id: app.propertyUnit?.variant?.property?.id,
                        title: app.propertyUnit?.variant?.property?.title,
                        unitNumber: app.propertyUnit?.unitNumber,
                    },
                    stage: {
                        id: stage.id,
                        name: stage.name,
                        order: stage.order,
                        status: stage.status,
                        activatedAt: stage.activatedAt,
                    },
                    pendingDocuments: pendingDocs,
                    sla: {
                        hours: binding.slaHours,
                        activatedAt: binding.activatedAt,
                        deadline: binding.slaHours && binding.activatedAt
                            ? new Date(new Date(binding.activatedAt).getTime() + binding.slaHours * 60 * 60 * 1000)
                            : null,
                        breached: binding.slaBreachedAt != null,
                        breachedAt: binding.slaBreachedAt,
                    },
                    binding: {
                        id: binding.id,
                        status: binding.status,
                        assignedAt: binding.assignedAt,
                    },
                });
            }
        }

        // Sort by SLA deadline (closest first)
        pendingReviews.sort((a, b) => {
            const aDeadline = a.sla.deadline?.getTime() || Infinity;
            const bDeadline = b.sla.deadline?.getTime() || Infinity;
            return aDeadline - bDeadline;
        });

        res.json(successResponse({
            organization: {
                id: organization.id,
                name: organization.name,
                types: orgTypeCodes,
                primaryType: primaryTypeCode,
            },
            pendingReviews,
            totalCount: pendingReviews.length,
        }));
    }
);

/**
 * GET /organizations/:orgId/applications
 * 
 * Returns all applications this organization is involved with.
 * Includes completed ones for historical reference.
 */
router.get(
    '/organizations/:orgId/applications',
    requireTenant,
    requireRole([ROLES.LENDER, ROLES.DEVELOPER, ROLES.LEGAL, ...Object.values(ROLES).filter(r => r.includes('ADMIN'))]),
    async (req: Request, res: Response) => {
        const { tenantId, userId, roles } = getAuthContext(req);
        const { orgId } = req.params;
        const tenantPrisma = getTenantPrisma(req);

        // Query params for filtering
        const { status, page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page as string, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
        const skip = (pageNum - 1) * limitNum;

        // Verify user belongs to this organization (or is admin)
        const isAdmin = roles?.some(r => r.includes('ADMIN'));
        if (!isAdmin) {
            const membership = await tenantPrisma.organizationMember.findFirst({
                where: {
                    organizationId: orgId as string,
                    userId,
                },
            });
            if (!membership) {
                throw new AppError(403, 'You are not a member of this organization');
            }
        }

        // Build filter
        const whereClause: any = {
            organizationId: orgId as string,
        };
        if (status) {
            whereClause.status = status;
        }

        const [bindings, total] = await Promise.all([
            tenantPrisma.applicationOrganization.findMany({
                where: whereClause,
                include: {
                    application: {
                        include: {
                            buyer: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    email: true,
                                },
                            },
                            propertyUnit: {
                                include: {
                                    variant: {
                                        include: {
                                            property: {
                                                select: {
                                                    id: true,
                                                    title: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: { assignedAt: 'desc' },
                skip,
                take: limitNum,
            }),
            tenantPrisma.applicationOrganization.count({ where: whereClause }),
        ]);

        res.json(successResponse({
            applications: bindings.map(b => ({
                bindingId: b.id,
                status: b.status,
                isPrimary: b.isPrimary,
                assignedAt: b.assignedAt,
                activatedAt: b.activatedAt,
                completedAt: b.completedAt,
                sla: {
                    hours: b.slaHours,
                    startedAt: b.slaStartedAt,
                    breachedAt: b.slaBreachedAt,
                },
                application: {
                    id: b.application.id,
                    applicationNumber: b.application.applicationNumber,
                    status: b.application.status,
                    customer: {
                        id: b.application.buyer.id,
                        name: `${b.application.buyer.firstName || ''} ${b.application.buyer.lastName || ''}`.trim(),
                        email: b.application.buyer.email,
                    },
                    property: {
                        id: b.application.propertyUnit?.variant?.property?.id,
                        title: b.application.propertyUnit?.variant?.property?.title,
                        unitNumber: b.application.propertyUnit?.unitNumber,
                    },
                },
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        }));
    }
);

// =============================================================================
// BANK DOCUMENT REQUIREMENTS
// =============================================================================
// Banks can specify additional/stricter document requirements beyond the base plan.
// Requirements are scoped to a specific PHASE within a payment method, allowing
// different requirements for different products (e.g., UBA MREIF vs UBA NHF).
// =============================================================================

const BankDocumentRequirementSchema = z.object({
    phaseId: z.string().min(1), // The specific payment method phase
    documentType: z.string().min(1), // ID_CARD, BANK_STATEMENT, etc.
    documentName: z.string().min(1), // Human-readable name
    modifier: z.enum(['STRICTER', 'REQUIRED', 'OPTIONAL', 'NOT_REQUIRED']).default('REQUIRED'),
    description: z.string().optional(),
    expiryDays: z.number().int().positive().optional(),
    minFiles: z.number().int().positive().optional(),
    maxFiles: z.number().int().positive().optional(),
    allowedMimeTypes: z.string().optional(), // Comma-separated
    validationRules: z.any().optional(), // JSON object for validation
    priority: z.number().int().default(100),
});

/**
 * GET /organizations/:orgId/document-requirements
 * 
 * Get all document requirements for a bank.
 */
router.get(
    '/organizations/:orgId/document-requirements',
    requireTenant,
    requireRole([ROLES.LENDER, ...Object.values(ROLES).filter(r => r.includes('ADMIN'))]),
    async (req: Request, res: Response) => {
        const { userId, roles } = getAuthContext(req);
        const { orgId } = req.params;
        const tenantPrisma = getTenantPrisma(req);

        // Verify organization exists
        const organization = await tenantPrisma.organization.findUnique({
            where: { id: orgId as string },
        });

        if (!organization) {
            throw new AppError(404, 'Organization not found');
        }

        // Check if organization is a bank
        const isBank = await hasOrgType(tenantPrisma, orgId as string, 'BANK');
        if (!isBank) {
            throw new AppError(400, 'Document requirements are only applicable to bank organizations');
        }

        // Verify membership (or admin)
        const isAdmin = roles?.some(r => r.includes('ADMIN'));
        if (!isAdmin) {
            const membership = await tenantPrisma.organizationMember.findFirst({
                where: {
                    organizationId: orgId as string,
                    userId,
                },
            });
            if (!membership) {
                throw new AppError(403, 'You are not a member of this organization');
            }
        }

        const requirements = await tenantPrisma.bankDocumentRequirement.findMany({
            where: { organizationId: orgId as string },
            orderBy: { documentType: 'asc' },
            include: {
                phase: {
                    select: {
                        id: true,
                        name: true,
                        phaseType: true,
                        paymentMethod: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        res.json(successResponse({
            organization: {
                id: organization.id,
                name: organization.name,
            },
            requirements,
        }));
    }
);

/**
 * POST /organizations/:orgId/document-requirements
 * 
 * Add a document requirement for a bank.
 */
router.post(
    '/organizations/:orgId/document-requirements',
    requireTenant,
    requireRole([ROLES.LENDER, ...Object.values(ROLES).filter(r => r.includes('ADMIN'))]),
    async (req: Request, res: Response) => {
        const { userId, roles } = getAuthContext(req);
        const { orgId } = req.params;
        const tenantPrisma = getTenantPrisma(req);

        const data = BankDocumentRequirementSchema.parse(req.body);

        // Verify organization exists
        const organization = await tenantPrisma.organization.findUnique({
            where: { id: orgId as string },
        });

        if (!organization) {
            throw new AppError(404, 'Organization not found');
        }

        // Check if organization is a bank
        const isBank = await hasOrgType(tenantPrisma, orgId as string, 'BANK');
        if (!isBank) {
            throw new AppError(400, 'Document requirements are only applicable to bank organizations');
        }

        // Verify membership (or admin) - roles are now managed via RBAC, not org member role
        const isAdmin = roles?.some(r => r.includes('ADMIN'));
        if (!isAdmin) {
            const membership = await tenantPrisma.organizationMember.findFirst({
                where: {
                    organizationId: orgId as string,
                    userId,
                },
            });
            if (!membership) {
                throw new AppError(403, 'You must be a member of this organization to manage document requirements');
            }
        }

        // Check for existing requirement for this document type
        const existing = await tenantPrisma.bankDocumentRequirement.findFirst({
            where: {
                organizationId: orgId as string,
                documentType: data.documentType,
                phaseId: data.phaseId,
            },
        });

        if (existing) {
            throw new AppError(409, `Requirement for document type '${data.documentType}' already exists for this phase. Use PUT to update.`);
        }

        // Verify phase exists and is a documentation phase
        const phase = await tenantPrisma.propertyPaymentMethodPhase.findUnique({
            where: { id: data.phaseId },
            include: { paymentMethod: { select: { name: true } } },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        if (phase.phaseCategory !== 'DOCUMENTATION') {
            throw new AppError(400, 'Bank document requirements can only be added to DOCUMENTATION phases');
        }

        const requirement = await tenantPrisma.bankDocumentRequirement.create({
            data: {
                organizationId: orgId as string,
                tenantId: organization.tenantId,
                phaseId: data.phaseId,
                documentType: data.documentType,
                documentName: data.documentName,
                modifier: data.modifier,
                description: data.description,
                expiryDays: data.expiryDays,
                minFiles: data.minFiles,
                maxFiles: data.maxFiles,
                allowedMimeTypes: data.allowedMimeTypes,
                validationRules: data.validationRules,
                priority: data.priority,
            },
            include: {
                phase: {
                    select: {
                        id: true,
                        name: true,
                        phaseType: true,
                        paymentMethod: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        res.status(201).json(successResponse(requirement));
    }
);

/**
 * PUT /organizations/:orgId/document-requirements/:reqId
 * 
 * Update a document requirement.
 */
router.put(
    '/organizations/:orgId/document-requirements/:reqId',
    requireTenant,
    requireRole([ROLES.LENDER, ...Object.values(ROLES).filter(r => r.includes('ADMIN'))]),
    async (req: Request, res: Response) => {
        const { userId, roles } = getAuthContext(req);
        const { orgId, reqId } = req.params;
        const tenantPrisma = getTenantPrisma(req);

        const data = BankDocumentRequirementSchema.partial().parse(req.body);

        // Verify requirement exists and belongs to this org
        const requirement = await tenantPrisma.bankDocumentRequirement.findFirst({
            where: {
                id: reqId as string,
                organizationId: orgId as string,
            },
        });

        if (!requirement) {
            throw new AppError(404, 'Document requirement not found');
        }

        // Verify membership (or admin) - roles are now managed via RBAC
        const isAdmin = roles?.some(r => r.includes('ADMIN'));
        if (!isAdmin) {
            const membership = await tenantPrisma.organizationMember.findFirst({
                where: {
                    organizationId: orgId as string,
                    userId,
                },
            });
            if (!membership) {
                throw new AppError(403, 'You must be a member of this organization to manage document requirements');
            }
        }

        const updated = await tenantPrisma.bankDocumentRequirement.update({
            where: { id: reqId as string },
            data: {
                phaseId: data.phaseId,
                documentType: data.documentType,
                documentName: data.documentName,
                modifier: data.modifier,
                description: data.description,
                expiryDays: data.expiryDays,
                minFiles: data.minFiles,
                maxFiles: data.maxFiles,
                allowedMimeTypes: data.allowedMimeTypes,
                validationRules: data.validationRules,
                priority: data.priority,
            },
            include: {
                phase: {
                    select: {
                        id: true,
                        name: true,
                        phaseType: true,
                        paymentMethod: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        res.json(successResponse(updated));
    }
);

/**
 * DELETE /organizations/:orgId/document-requirements/:reqId
 * 
 * Delete a document requirement.
 */
router.delete(
    '/organizations/:orgId/document-requirements/:reqId',
    requireTenant,
    requireRole([ROLES.LENDER, ...Object.values(ROLES).filter(r => r.includes('ADMIN'))]),
    async (req: Request, res: Response) => {
        const { userId, roles } = getAuthContext(req);
        const { orgId, reqId } = req.params;
        const tenantPrisma = getTenantPrisma(req);

        // Verify requirement exists and belongs to this org
        const requirement = await tenantPrisma.bankDocumentRequirement.findFirst({
            where: {
                id: reqId as string,
                organizationId: orgId as string,
            },
        });

        if (!requirement) {
            throw new AppError(404, 'Document requirement not found');
        }

        // Verify membership (or admin) - roles are now managed via RBAC
        const isAdmin = roles?.some(r => r.includes('ADMIN'));
        if (!isAdmin) {
            const membership = await tenantPrisma.organizationMember.findFirst({
                where: {
                    organizationId: orgId as string,
                    userId,
                },
            });
            if (!membership) {
                throw new AppError(403, 'You must be a member of this organization to manage document requirements');
            }
        }

        await tenantPrisma.bankDocumentRequirement.delete({
            where: { id: reqId as string },
        });

        res.json(successResponse({ deleted: true }));
    }
);

export default router;