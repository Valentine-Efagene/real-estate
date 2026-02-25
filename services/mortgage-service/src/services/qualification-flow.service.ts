import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, Prisma, PrismaClient } from '@valentine-efagene/qshelter-common';
import type {
    CreateQualificationFlowInput,
    UpdateQualificationFlowInput,
    ApplyForPaymentMethodInput,
    ReviewQualificationInput,
    UpdateQualificationStatusInput,
    AssignQualificationFlowInput,
    CreateDocumentWaiverInput,
} from '../validators/qualification-flow.validator';

type AnyPrismaClient = PrismaClient;

/** Service interface to avoid non-portable inferred types */
export interface QualificationFlowService {
    // Flow template CRUD
    createFlow(tenantId: string, data: CreateQualificationFlowInput): Promise<any>;
    findAllFlows(filters?: { isActive?: boolean }): Promise<any[]>;
    findFlowById(id: string): Promise<any>;
    updateFlow(id: string, data: UpdateQualificationFlowInput): Promise<any>;
    deleteFlow(id: string): Promise<{ success: boolean }>;

    // Assign flow to payment method (per org type)
    assignToPaymentMethod(paymentMethodId: string, data: AssignQualificationFlowInput): Promise<any>;

    // List qualification configs for a payment method
    findQualificationConfigs(paymentMethodId: string): Promise<any[]>;

    // Remove a qualification config
    removeQualificationConfig(paymentMethodId: string, organizationTypeCode: string, tenantId: string): Promise<{ success: boolean }>;

    // Organization applies for payment method access
    applyForPaymentMethod(paymentMethodId: string, tenantId: string, data: ApplyForPaymentMethodInput): Promise<any>;

    // List org assignments for a payment method
    findAssignments(paymentMethodId: string, filters?: { status?: string }): Promise<any[]>;

    // Get qualification progress for an org-payment-method assignment
    findQualification(assignmentId: string): Promise<any>;

    // Admin review of a gate phase in the qualification
    reviewGatePhase(qualificationPhaseId: string, reviewerId: string, data: ReviewQualificationInput): Promise<any>;

    // Admin directly update assignment status (e.g., suspend, reject)
    updateAssignmentStatus(assignmentId: string, data: UpdateQualificationStatusInput): Promise<any>;

    // Find all payment methods an org is assigned to (with qualification status)
    findOrgPaymentMethods(organizationId: string): Promise<any[]>;

    // Document waivers — docs an org considers optional for a payment method
    createDocumentWaiver(assignmentId: string, tenantId: string, userId: string, data: CreateDocumentWaiverInput): Promise<any>;
    deleteDocumentWaiver(waiverId: string): Promise<{ success: boolean }>;
    findDocumentWaivers(assignmentId: string): Promise<any[]>;
    findWaivableDocuments(assignmentId: string): Promise<any[]>;
}

export function createQualificationFlowService(prisma: AnyPrismaClient = defaultPrisma): QualificationFlowService {

    // =========================================================================
    // QUALIFICATION FLOW TEMPLATE CRUD
    // =========================================================================

    async function createFlow(tenantId: string, data: CreateQualificationFlowInput) {
        const { phases, ...flowData } = data;

        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const flow = await tx.qualificationFlow.create({
                data: {
                    tenantId,
                    ...flowData,
                    phases: {
                        create: phases.map((phase) => ({
                            tenantId,
                            questionnairePlanId: phase.questionnairePlanId,
                            documentationPlanId: phase.documentationPlanId,
                            gatePlanId: phase.gatePlanId,
                            name: phase.name,
                            description: phase.description,
                            phaseCategory: phase.phaseCategory,
                            phaseType: phase.phaseType,
                            order: phase.order,
                            requiresPreviousPhaseCompletion: phase.requiresPreviousPhaseCompletion ?? true,
                        })),
                    },
                },
                include: {
                    phases: { orderBy: { order: 'asc' } },
                },
            });
            return flow;
        });
    }

    async function findAllFlows(filters?: { isActive?: boolean }) {
        const where: any = {};
        if (filters?.isActive !== undefined) where.isActive = filters.isActive;

        return prisma.qualificationFlow.findMany({
            where,
            include: {
                phases: { orderBy: { order: 'asc' } },
                _count: { select: { qualificationConfigs: true, qualifications: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async function findFlowById(id: string) {
        const flow = await prisma.qualificationFlow.findUnique({
            where: { id },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        questionnairePlan: true,
                        documentationPlan: true,
                        gatePlan: true,
                    },
                },
                qualificationConfigs: {
                    include: {
                        organizationType: { select: { id: true, code: true, name: true } },
                        paymentMethod: { select: { id: true, name: true } },
                    },
                },
                _count: { select: { qualifications: true } },
            },
        });
        if (!flow) throw new AppError(404, 'Qualification flow not found');
        return flow;
    }

    async function updateFlow(id: string, data: UpdateQualificationFlowInput) {
        const existing = await findFlowById(id);
        const { phases, ...flowData } = data;

        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Update flow metadata
            const flow = await tx.qualificationFlow.update({
                where: { id },
                data: flowData,
            });

            // If phases provided, replace them (delete + recreate)
            if (phases) {
                await tx.qualificationFlowPhase.deleteMany({
                    where: { qualificationFlowId: id },
                });
                await tx.qualificationFlowPhase.createMany({
                    data: phases.map((phase) => ({
                        tenantId: existing.tenantId,
                        qualificationFlowId: id,
                        questionnairePlanId: phase.questionnairePlanId,
                        documentationPlanId: phase.documentationPlanId,
                        gatePlanId: phase.gatePlanId,
                        name: phase.name,
                        description: phase.description,
                        phaseCategory: phase.phaseCategory,
                        phaseType: phase.phaseType,
                        order: phase.order,
                        requiresPreviousPhaseCompletion: phase.requiresPreviousPhaseCompletion ?? true,
                    })),
                });
            }

            return findFlowById(id);
        });
    }

    async function deleteFlow(id: string) {
        await findFlowById(id); // Validates exists
        await prisma.qualificationFlow.delete({ where: { id } });
        return { success: true };
    }

    // =========================================================================
    // ASSIGN QUALIFICATION FLOW TO PAYMENT METHOD
    // =========================================================================

    async function assignToPaymentMethod(paymentMethodId: string, data: AssignQualificationFlowInput) {
        // Validate payment method exists
        const method = await prisma.propertyPaymentMethod.findUnique({ where: { id: paymentMethodId } });
        if (!method) throw new AppError(404, 'Payment method not found');

        // Validate qualification flow exists
        const flow = await prisma.qualificationFlow.findUnique({ where: { id: data.qualificationFlowId } });
        if (!flow) throw new AppError(404, 'Qualification flow not found');

        // Ensure same tenant
        if (method.tenantId !== flow.tenantId) {
            throw new AppError(400, 'Payment method and qualification flow must belong to the same tenant');
        }

        // Resolve organization type by code
        const orgType = await prisma.organizationType.findFirst({
            where: { tenantId: method.tenantId, code: data.organizationTypeCode },
        });
        if (!orgType) throw new AppError(404, `Organization type '${data.organizationTypeCode}' not found`);

        // Upsert the qualification config for this org type
        const config = await prisma.paymentMethodQualificationConfig.upsert({
            where: {
                paymentMethodId_organizationTypeId: {
                    paymentMethodId,
                    organizationTypeId: orgType.id,
                },
            },
            create: {
                tenantId: method.tenantId,
                paymentMethodId,
                organizationTypeId: orgType.id,
                qualificationFlowId: data.qualificationFlowId,
            },
            update: {
                qualificationFlowId: data.qualificationFlowId,
            },
            include: {
                qualificationFlow: { include: { phases: { orderBy: { order: 'asc' } } } },
                organizationType: true,
            },
        });
        return config;
    }

    // =========================================================================
    // ORGANIZATION APPLIES FOR PAYMENT METHOD ACCESS
    // =========================================================================

    async function applyForPaymentMethod(paymentMethodId: string, tenantId: string, data: ApplyForPaymentMethodInput) {
        // Validate payment method exists
        const method = await prisma.propertyPaymentMethod.findUnique({
            where: { id: paymentMethodId },
            include: {
                qualificationConfigs: {
                    include: {
                        qualificationFlow: {
                            include: { phases: { orderBy: { order: 'asc' } } },
                        },
                        organizationType: true,
                    },
                },
            },
        });
        if (!method) throw new AppError(404, 'Payment method not found');
        if (!method.isActive) throw new AppError(400, 'Payment method is not active');

        // Validate organization exists and get its types
        const org = await prisma.organization.findUnique({
            where: { id: data.organizationId },
            include: {
                types: { include: { orgType: true } },
            },
        });
        if (!org) throw new AppError(404, 'Organization not found');

        // Check not already assigned
        const existing = await prisma.organizationPaymentMethod.findUnique({
            where: {
                organizationId_paymentMethodId: {
                    organizationId: data.organizationId,
                    paymentMethodId,
                },
            },
        });
        if (existing) {
            throw new AppError(409, `Organization is already ${existing.status.toLowerCase()} for this payment method`);
        }

        // Find matching qualification config by org type
        const orgTypeIds = org.types.map((t: any) => t.typeId);
        const matchingConfig = (method as any).qualificationConfigs.find(
            (config: any) => orgTypeIds.includes(config.organizationTypeId),
        );
        const qualificationFlow = matchingConfig?.qualificationFlow || null;

        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Create the org-payment-method assignment
            const assignment = await tx.organizationPaymentMethod.create({
                data: {
                    tenantId,
                    organizationId: data.organizationId,
                    paymentMethodId,
                    status: qualificationFlow ? 'PENDING' : 'QUALIFIED', // Auto-qualify if no flow for this org type
                    qualifiedAt: qualificationFlow ? null : new Date(),
                    preferredStaffId: data.preferredStaffId || null,
                    notes: data.notes,
                },
            });

            // If there's a qualification flow for this org type, create the workflow instance
            if (qualificationFlow) {
                const flow = qualificationFlow;
                const expiresAt = flow.expiresInDays
                    ? new Date(Date.now() + flow.expiresInDays * 24 * 60 * 60 * 1000)
                    : null;

                // Create qualification workflow instance with phases
                const qualification = await tx.paymentMethodQualification.create({
                    data: {
                        tenantId,
                        organizationPaymentMethodId: assignment.id,
                        qualificationFlowId: flow.id,
                        templateSnapshot: JSON.parse(JSON.stringify(flow)),
                        status: 'PENDING',
                        expiresAt,
                        phases: {
                            create: flow.phases.map((phaseTemplate: any) => ({
                                tenantId,
                                phaseTemplateId: phaseTemplate.id,
                                name: phaseTemplate.name,
                                description: phaseTemplate.description,
                                phaseCategory: phaseTemplate.phaseCategory,
                                phaseType: phaseTemplate.phaseType,
                                order: phaseTemplate.order,
                                status: 'PENDING',
                                requiresPreviousPhaseCompletion: phaseTemplate.requiresPreviousPhaseCompletion,
                            })),
                        },
                    },
                    include: {
                        phases: { orderBy: { order: 'asc' } },
                    },
                });

                // Create phase extension records (questionnaire, documentation, or gate)
                for (const phase of qualification.phases) {
                    const template = flow.phases.find((t: any) => t.order === phase.order);
                    if (!template) continue;

                    if (phase.phaseCategory === 'QUESTIONNAIRE' && template.questionnairePlanId) {
                        await tx.questionnairePhase.create({
                            data: {
                                tenantId,
                                qualificationPhaseId: phase.id,
                                questionnairePlanId: template.questionnairePlanId,
                            },
                        });
                    } else if (phase.phaseCategory === 'DOCUMENTATION' && template.documentationPlanId) {
                        await tx.documentationPhase.create({
                            data: {
                                tenantId,
                                qualificationPhaseId: phase.id,
                                documentationPlanId: template.documentationPlanId,
                            },
                        });
                    } else if (phase.phaseCategory === 'GATE' && template.gatePlanId) {
                        const gatePlan = await tx.gatePlan.findUnique({
                            where: { id: template.gatePlanId },
                        });
                        if (gatePlan) {
                            await tx.gatePhase.create({
                                data: {
                                    tenantId,
                                    qualificationPhaseId: phase.id,
                                    gatePlanId: template.gatePlanId,
                                    requiredApprovals: gatePlan.requiredApprovals,
                                    reviewerOrganizationTypeId: gatePlan.reviewerOrganizationTypeId,
                                    reviewerInstructions: gatePlan.reviewerInstructions,
                                    gatePlanSnapshot: JSON.parse(JSON.stringify(gatePlan)),
                                },
                            });
                        }
                    }
                }

                // Set current phase to first phase and activate it
                const firstPhase = qualification.phases[0];
                if (firstPhase) {
                    await tx.qualificationPhase.update({
                        where: { id: firstPhase.id },
                        data: { status: 'IN_PROGRESS', activatedAt: new Date() },
                    });
                    await tx.paymentMethodQualification.update({
                        where: { id: qualification.id },
                        data: {
                            currentPhaseId: firstPhase.id,
                            status: 'IN_PROGRESS',
                            startedAt: new Date(),
                        },
                    });
                    // Also update the assignment status
                    await tx.organizationPaymentMethod.update({
                        where: { id: assignment.id },
                        data: { status: 'IN_PROGRESS' },
                    });
                }

                return tx.organizationPaymentMethod.findUnique({
                    where: { id: assignment.id },
                    include: {
                        organization: { select: { id: true, name: true } },
                        paymentMethod: { select: { id: true, name: true } },
                        qualification: {
                            include: {
                                phases: {
                                    orderBy: { order: 'asc' },
                                    include: {
                                        questionnairePhase: true,
                                        documentationPhase: true,
                                        gatePhase: true,
                                    },
                                },
                            },
                        },
                    },
                });
            }

            // No qualification flow — return the auto-qualified assignment
            return tx.organizationPaymentMethod.findUnique({
                where: { id: assignment.id },
                include: {
                    organization: { select: { id: true, name: true } },
                    paymentMethod: { select: { id: true, name: true } },
                },
            });
        });
    }

    // =========================================================================
    // QUERY ASSIGNMENTS
    // =========================================================================

    async function findAssignments(paymentMethodId: string, filters?: { status?: string }) {
        const where: any = { paymentMethodId };
        if (filters?.status) where.status = filters.status;

        return prisma.organizationPaymentMethod.findMany({
            where,
            include: {
                organization: { select: { id: true, name: true, status: true } },
                qualification: {
                    select: {
                        id: true,
                        status: true,
                        startedAt: true,
                        completedAt: true,
                        _count: { select: { phases: true } },
                    },
                },
            },
            orderBy: { appliedAt: 'desc' },
        });
    }

    async function findQualification(assignmentId: string) {
        const assignment = await prisma.organizationPaymentMethod.findUnique({
            where: { id: assignmentId },
            include: {
                organization: { select: { id: true, name: true } },
                paymentMethod: { select: { id: true, name: true } },
                qualification: {
                    include: {
                        phases: {
                            orderBy: { order: 'asc' },
                            include: {
                                questionnairePhase: {
                                    include: { fields: true, reviews: true },
                                },
                                documentationPhase: {
                                    include: { stageProgress: true },
                                },
                                gatePhase: {
                                    include: { reviews: true },
                                },
                            },
                        },
                        currentPhase: true,
                    },
                },
            },
        });
        if (!assignment) throw new AppError(404, 'Assignment not found');
        return assignment;
    }

    async function findOrgPaymentMethods(organizationId: string) {
        return prisma.organizationPaymentMethod.findMany({
            where: { organizationId },
            include: {
                paymentMethod: { select: { id: true, name: true, description: true, isActive: true } },
                qualification: {
                    select: {
                        id: true,
                        status: true,
                        startedAt: true,
                        completedAt: true,
                        currentPhase: { select: { id: true, name: true, order: true, status: true } },
                    },
                },
            },
            orderBy: { appliedAt: 'desc' },
        });
    }

    // =========================================================================
    // REVIEW GATE PHASE (admin approval within qualification workflow)
    // =========================================================================

    async function reviewGatePhase(qualificationPhaseId: string, reviewerId: string, data: ReviewQualificationInput) {
        // Find the qualification phase + its gate extension
        const phase = await prisma.qualificationPhase.findUnique({
            where: { id: qualificationPhaseId },
            include: {
                gatePhase: { include: { reviewerOrganizationType: true } },
                qualification: {
                    include: {
                        organizationPaymentMethod: true,
                        phases: { orderBy: { order: 'asc' } },
                    },
                },
            },
        });
        if (!phase) throw new AppError(404, 'Qualification phase not found');
        if (!phase.gatePhase) throw new AppError(400, 'This phase is not a GATE phase');
        if (phase.status !== 'IN_PROGRESS' && phase.status !== 'AWAITING_APPROVAL') {
            throw new AppError(400, `Cannot review a phase in ${phase.status} status`);
        }

        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const gate = phase.gatePhase!;
            const qualification = phase.qualification;

            // Record the review
            await tx.gatePhaseReview.create({
                data: {
                    tenantId: phase.tenantId,
                    gatePhaseId: gate.id,
                    reviewerId,
                    decision: data.decision,
                    notes: data.notes,
                },
            });

            if (data.decision === 'APPROVED') {
                const newApprovalCount = gate.approvalCount + 1;
                await tx.gatePhase.update({
                    where: { id: gate.id },
                    data: { approvalCount: newApprovalCount },
                });

                // Check if enough approvals
                if (newApprovalCount >= gate.requiredApprovals) {
                    // Complete this phase
                    await tx.qualificationPhase.update({
                        where: { id: phase.id },
                        data: { status: 'COMPLETED', completedAt: new Date() },
                    });

                    // Check if this was the last phase
                    const allPhases = qualification.phases;
                    const nextPhase = allPhases.find((p: any) => p.order > phase.order && p.status === 'PENDING');

                    if (nextPhase) {
                        // Activate next phase
                        await tx.qualificationPhase.update({
                            where: { id: nextPhase.id },
                            data: { status: 'IN_PROGRESS', activatedAt: new Date() },
                        });
                        await tx.paymentMethodQualification.update({
                            where: { id: qualification.id },
                            data: { currentPhaseId: nextPhase.id },
                        });
                    } else {
                        // All phases complete — qualification done
                        await tx.paymentMethodQualification.update({
                            where: { id: qualification.id },
                            data: {
                                status: 'COMPLETED',
                                completedAt: new Date(),
                                approvedAt: new Date(),
                                approvedById: reviewerId,
                            },
                        });
                        // Update the org-payment-method assignment to QUALIFIED
                        await tx.organizationPaymentMethod.update({
                            where: { id: qualification.organizationPaymentMethodId },
                            data: {
                                status: 'QUALIFIED',
                                qualifiedAt: new Date(),
                            },
                        });
                    }
                }
            } else {
                // REJECTED
                await tx.gatePhase.update({
                    where: { id: gate.id },
                    data: {
                        rejectionCount: gate.rejectionCount + 1,
                        rejectionReason: data.notes,
                    },
                });

                // Reject the entire qualification
                await tx.qualificationPhase.update({
                    where: { id: phase.id },
                    data: { status: 'COMPLETED', completedAt: new Date() },
                });
                await tx.paymentMethodQualification.update({
                    where: { id: qualification.id },
                    data: {
                        status: 'REJECTED',
                        completedAt: new Date(),
                    },
                });
                await tx.organizationPaymentMethod.update({
                    where: { id: qualification.organizationPaymentMethodId },
                    data: { status: 'REJECTED' },
                });
            }

            // Return updated state
            return findQualification(qualification.organizationPaymentMethodId);
        });
    }

    // =========================================================================
    // UPDATE ASSIGNMENT STATUS (admin override)
    // =========================================================================

    async function updateAssignmentStatus(assignmentId: string, data: UpdateQualificationStatusInput) {
        const assignment = await prisma.organizationPaymentMethod.findUnique({
            where: { id: assignmentId },
        });
        if (!assignment) throw new AppError(404, 'Assignment not found');

        const updateData: any = { status: data.status };
        if (data.notes) updateData.notes = data.notes;
        if (data.status === 'QUALIFIED') updateData.qualifiedAt = new Date();
        if (data.status === 'SUSPENDED') updateData.suspendedAt = new Date();

        // Handle preferredStaffId: null = unassign, string = assign
        if (data.preferredStaffId !== undefined) {
            if (data.preferredStaffId === null) {
                updateData.preferredStaffId = null;
            } else {
                // Validate the staff member belongs to this organization
                const membership = await prisma.organizationMember.findFirst({
                    where: {
                        organizationId: assignment.organizationId,
                        userId: data.preferredStaffId,
                        isActive: true,
                    },
                });
                if (!membership) {
                    throw new AppError(400, 'Preferred staff must be an active member of the organization');
                }
                updateData.preferredStaffId = data.preferredStaffId;
            }
        }

        return prisma.organizationPaymentMethod.update({
            where: { id: assignmentId },
            data: updateData,
            include: {
                organization: { select: { id: true, name: true } },
                paymentMethod: { select: { id: true, name: true } },
                preferredStaff: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
    }

    // =========================================================================
    // QUALIFICATION CONFIG — List / Remove per-org-type configs
    // =========================================================================

    async function findQualificationConfigs(paymentMethodId: string) {
        return prisma.paymentMethodQualificationConfig.findMany({
            where: { paymentMethodId },
            include: {
                qualificationFlow: { select: { id: true, name: true, isActive: true } },
                organizationType: { select: { id: true, code: true, name: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async function removeQualificationConfig(paymentMethodId: string, organizationTypeCode: string, tenantId: string) {
        const orgType = await prisma.organizationType.findFirst({
            where: { tenantId, code: organizationTypeCode },
        });
        if (!orgType) throw new AppError(404, `Organization type '${organizationTypeCode}' not found`);

        const config = await prisma.paymentMethodQualificationConfig.findUnique({
            where: {
                paymentMethodId_organizationTypeId: {
                    paymentMethodId,
                    organizationTypeId: orgType.id,
                },
            },
        });
        if (!config) throw new AppError(404, 'Qualification config not found for this organization type');

        await prisma.paymentMethodQualificationConfig.delete({ where: { id: config.id } });
        return { success: true };
    }

    // =========================================================================
    // DOCUMENT WAIVERS — Docs an org considers optional for a payment method
    // =========================================================================

    async function createDocumentWaiver(assignmentId: string, tenantId: string, userId: string, data: CreateDocumentWaiverInput) {
        // Validate assignment exists and is QUALIFIED
        const assignment = await prisma.organizationPaymentMethod.findUnique({
            where: { id: assignmentId },
        });
        if (!assignment) throw new AppError(404, 'Assignment not found');
        if (assignment.status !== 'QUALIFIED') {
            throw new AppError(400, 'Organization must be QUALIFIED before configuring document waivers');
        }

        // Validate document definition exists
        const docDef = await prisma.documentDefinition.findUnique({
            where: { id: data.documentDefinitionId },
        });
        if (!docDef) throw new AppError(404, 'Document definition not found');

        // Verify the document definition belongs to a documentation plan used by this payment method
        const method = await prisma.propertyPaymentMethod.findUnique({
            where: { id: assignment.paymentMethodId },
            include: {
                phases: {
                    where: { phaseCategory: 'DOCUMENTATION' },
                    select: { documentationPlanId: true },
                },
            },
        });
        const planIds = (method?.phases || []).map((p: any) => p.documentationPlanId).filter(Boolean);
        if (!planIds.includes(docDef.planId)) {
            throw new AppError(400, 'Document definition does not belong to any documentation phase of this payment method');
        }

        // Check for duplicate
        const existing = await prisma.organizationDocumentWaiver.findUnique({
            where: {
                organizationPaymentMethodId_documentDefinitionId: {
                    organizationPaymentMethodId: assignmentId,
                    documentDefinitionId: data.documentDefinitionId,
                },
            },
        });
        if (existing) throw new AppError(409, 'Waiver already exists for this document');

        return prisma.organizationDocumentWaiver.create({
            data: {
                tenantId,
                organizationPaymentMethodId: assignmentId,
                documentDefinitionId: data.documentDefinitionId,
                reason: data.reason,
                waivedById: userId,
            },
            include: {
                documentDefinition: { select: { id: true, documentType: true, documentName: true, planId: true } },
            },
        });
    }

    async function deleteDocumentWaiver(waiverId: string) {
        const waiver = await prisma.organizationDocumentWaiver.findUnique({ where: { id: waiverId } });
        if (!waiver) throw new AppError(404, 'Document waiver not found');
        await prisma.organizationDocumentWaiver.delete({ where: { id: waiverId } });
        return { success: true };
    }

    async function findDocumentWaivers(assignmentId: string) {
        return prisma.organizationDocumentWaiver.findMany({
            where: { organizationPaymentMethodId: assignmentId },
            include: {
                documentDefinition: {
                    select: { id: true, documentType: true, documentName: true, planId: true, isRequired: true, uploadedBy: true },
                },
                waivedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * List all document definitions across all DOCUMENTATION phases of a payment method
     * that can be waived by this org. Returns docs with waiver status.
     */
    async function findWaivableDocuments(assignmentId: string) {
        const assignment = await prisma.organizationPaymentMethod.findUnique({
            where: { id: assignmentId },
            include: {
                paymentMethod: {
                    include: {
                        phases: {
                            where: { phaseCategory: 'DOCUMENTATION' },
                            include: {
                                documentationPlan: {
                                    include: {
                                        documentDefinitions: { orderBy: { order: 'asc' } },
                                    },
                                },
                            },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                documentWaivers: true,
            },
        });
        if (!assignment) throw new AppError(404, 'Assignment not found');

        const waivedDocIds = new Set(assignment.documentWaivers.map((w: any) => w.documentDefinitionId));

        // Flatten all document definitions across all doc phases
        const result: any[] = [];
        for (const phase of (assignment as any).paymentMethod.phases) {
            if (!phase.documentationPlan) continue;
            for (const docDef of phase.documentationPlan.documentDefinitions) {
                result.push({
                    ...docDef,
                    phaseName: phase.name,
                    phaseId: phase.id,
                    planName: phase.documentationPlan.name,
                    isWaived: waivedDocIds.has(docDef.id),
                    waiver: assignment.documentWaivers.find((w: any) => w.documentDefinitionId === docDef.id) || null,
                });
            }
        }

        return result;
    }

    // =========================================================================
    // RETURN INTERFACE
    // =========================================================================

    return {
        createFlow,
        findAllFlows,
        findFlowById,
        updateFlow,
        deleteFlow,
        assignToPaymentMethod,
        findQualificationConfigs,
        removeQualificationConfig,
        applyForPaymentMethod,
        findAssignments,
        findQualification,
        reviewGatePhase,
        updateAssignmentStatus,
        findOrgPaymentMethods,
        createDocumentWaiver,
        deleteDocumentWaiver,
        findDocumentWaivers,
        findWaivableDocuments,
    };
}

// Default singleton for backward compatibility
export const qualificationFlowService: QualificationFlowService = createQualificationFlowService();
