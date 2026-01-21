import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient, PhaseType, StepType, StepTrigger, PhaseTrigger } from '@valentine-efagene/qshelter-common';
import type {
    CreatePaymentMethodInput,
    UpdatePaymentMethodInput,
    AddPhaseInput,
    LinkToPropertyInput,
    AddStepInput,
    UpdateStepInput,
    AddDocumentRequirementInput,
    UpdateDocumentRequirementInput,
    ClonePaymentMethodInput,
    AddPhaseEventAttachmentInput,
    UpdatePhaseEventAttachmentInput,
    AddStepEventAttachmentInput,
    UpdateStepEventAttachmentInput,
} from '../validators/payment-method.validator';

type AnyPrismaClient = PrismaClient;

/** Service interface to avoid non-portable inferred types */
export interface PaymentMethodService {
    create(tenantId: string, data: CreatePaymentMethodInput): Promise<any>;
    findAll(filters?: { isActive?: boolean }): Promise<any[]>;
    findById(id: string): Promise<any>;
    update(id: string, data: UpdatePaymentMethodInput): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    clone(id: string, tenantId: string, data: ClonePaymentMethodInput): Promise<any>;
    addPhase(methodId: string, data: AddPhaseInput): Promise<any>;
    updatePhase(phaseId: string, data: Partial<AddPhaseInput>): Promise<any>;
    deletePhase(phaseId: string): Promise<{ success: boolean }>;
    reorderPhases(methodId: string, phaseOrders: { phaseId: string; order: number }[]): Promise<any>;
    // Step CRUD
    addStep(phaseId: string, data: AddStepInput): Promise<any>;
    updateStep(stepId: string, data: UpdateStepInput): Promise<any>;
    deleteStep(stepId: string): Promise<{ success: boolean }>;
    reorderSteps(phaseId: string, stepOrders: { stepId: string; order: number }[]): Promise<any>;
    // Document requirement CRUD
    addDocumentRequirement(phaseId: string, data: AddDocumentRequirementInput): Promise<any>;
    updateDocumentRequirement(documentId: string, data: UpdateDocumentRequirementInput): Promise<any>;
    deleteDocumentRequirement(documentId: string): Promise<{ success: boolean }>;
    // Property linking
    linkToProperty(methodId: string, data: LinkToPropertyInput): Promise<any>;
    unlinkFromProperty(methodId: string, propertyId: string): Promise<{ success: boolean }>;
    getMethodsForProperty(propertyId: string): Promise<any[]>;
    // Phase event attachments
    addPhaseEventAttachment(phaseId: string, data: AddPhaseEventAttachmentInput): Promise<any>;
    getPhaseEventAttachments(phaseId: string): Promise<any[]>;
    updatePhaseEventAttachment(attachmentId: string, data: UpdatePhaseEventAttachmentInput): Promise<any>;
    deletePhaseEventAttachment(attachmentId: string): Promise<{ success: boolean }>;
    // Step event attachments
    addStepEventAttachment(stepId: string, data: AddStepEventAttachmentInput): Promise<any>;
    getStepEventAttachments(stepId: string): Promise<any[]>;
    updateStepEventAttachment(attachmentId: string, data: UpdateStepEventAttachmentInput): Promise<any>;
    deleteStepEventAttachment(attachmentId: string): Promise<{ success: boolean }>;
}

/**
 * Create a payment method service with the given Prisma client
 * Use this for tenant-scoped operations
 */
export function createPaymentMethodService(prisma: AnyPrismaClient = defaultPrisma): PaymentMethodService {
    async function create(tenantId: string, data: CreatePaymentMethodInput) {
        const { phases, ...methodData } = data;

        const method = await prisma.$transaction(async (tx: any) => {
            const created = await tx.propertyPaymentMethod.create({
                data: {
                    tenantId,
                    name: methodData.name,
                    description: methodData.description,
                    isActive: methodData.isActive ?? true,
                    allowEarlyPayoff: methodData.allowEarlyPayoff ?? true,
                    earlyPayoffPenaltyRate: methodData.earlyPayoffPenaltyRate,
                    autoActivatePhases: methodData.autoActivatePhases ?? true,
                    requiresManualApproval: methodData.requiresManualApproval ?? false,
                },
            });

            if (phases && phases.length > 0) {
                for (const phase of phases) {
                    if (phase.phaseCategory === 'PAYMENT' && !phase.paymentPlanId) {
                        throw new AppError(400, `Phase "${phase.name}" is a PAYMENT phase and requires paymentPlanId`);
                    }

                    // For DOCUMENTATION phases, either documentationPlanId or inline stepDefinitions should be provided
                    let stepDefinitionsToUse = phase.stepDefinitions;
                    const requiredDocumentTypesToUse = phase.requiredDocuments;

                    // If documentationPlanId is provided, just validate the plan exists
                    // The stage-based workflow uses documentDefinitions and approvalStages directly at runtime
                    if (phase.phaseCategory === 'DOCUMENTATION' && phase.documentationPlanId) {
                        const docPlan = await tx.documentationPlan.findUnique({
                            where: { id: phase.documentationPlanId },
                        });

                        if (!docPlan) {
                            throw new AppError(404, `Documentation plan "${phase.documentationPlanId}" not found`);
                        }
                    }

                    // For QUESTIONNAIRE phases, validate questionnairePlanId if provided
                    if (phase.phaseCategory === 'QUESTIONNAIRE' && phase.questionnairePlanId) {
                        const questionnairePlan = await tx.questionnairePlan.findUnique({
                            where: { id: phase.questionnairePlanId },
                            include: { questions: { orderBy: { order: 'asc' } } },
                        });

                        if (!questionnairePlan) {
                            throw new AppError(404, `Questionnaire plan "${phase.questionnairePlanId}" not found`);
                        }
                    }

                    // Store snapshots for audit
                    const stepDefinitionsSnapshot = stepDefinitionsToUse ? stepDefinitionsToUse : null;
                    const requiredDocumentSnapshot = requiredDocumentTypesToUse ? requiredDocumentTypesToUse : null;

                    const createdPhase = await tx.propertyPaymentMethodPhase.create({
                        data: {
                            tenantId,
                            paymentMethodId: created.id,
                            paymentPlanId: phase.paymentPlanId,
                            documentationPlanId: phase.documentationPlanId,
                            questionnairePlanId: phase.questionnairePlanId,
                            name: phase.name,
                            description: phase.description,
                            phaseCategory: phase.phaseCategory,
                            phaseType: phase.phaseType as PhaseType,
                            order: phase.order,
                            interestRate: phase.interestRate,
                            percentOfPrice: phase.percentOfPrice,
                            requiresPreviousPhaseCompletion: phase.requiresPreviousPhaseCompletion ?? true,
                            minimumCompletionPercentage: phase.minimumCompletionPercentage,
                            stepDefinitionsSnapshot,
                            requiredDocumentSnapshot,
                        },
                    });

                    // Create step child records
                    if (stepDefinitionsToUse && stepDefinitionsToUse.length > 0) {
                        for (const step of stepDefinitionsToUse) {
                            await tx.paymentMethodPhaseStep.create({
                                data: {
                                    tenantId,
                                    phaseId: createdPhase.id,
                                    name: step.name,
                                    stepType: step.stepType as StepType,
                                    order: step.order,
                                    metadata: step.metadata,
                                },
                            });
                        }
                    }

                    // Create required document child records
                    if (requiredDocumentTypesToUse && requiredDocumentTypesToUse.length > 0) {
                        for (const doc of requiredDocumentTypesToUse) {
                            await tx.paymentMethodPhaseDocument.create({
                                data: {
                                    tenantId,
                                    phaseId: createdPhase.id,
                                    documentType: doc.documentType,
                                    isRequired: doc.isRequired ?? true,
                                    description: doc.description,
                                    allowedMimeTypes: doc.allowedMimeTypes?.join(','),
                                    maxSizeBytes: doc.maxSizeBytes,
                                    metadata: doc.metadata,
                                },
                            });
                        }
                    }
                }
            }

            return created;
        });

        return findById(method.id);
    }

    async function findAll(filters?: { isActive?: boolean }) {
        const methods = await prisma.propertyPaymentMethod.findMany({
            where: filters,
            orderBy: { name: 'asc' },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        paymentPlan: true,
                        documentationPlan: {
                            include: {
                                documentDefinitions: { orderBy: { order: 'asc' } },
                                approvalStages: { orderBy: { order: 'asc' } },
                            },
                        },
                        questionnairePlan: {
                            include: { questions: { orderBy: { order: 'asc' } } },
                        },
                    },
                },
            },
        });
        return methods;
    }

    async function findById(id: string) {
        const method = await prisma.propertyPaymentMethod.findUnique({
            where: { id },
            include: {
                phases: {
                    orderBy: { order: 'asc' },
                    include: {
                        paymentPlan: true,
                        documentationPlan: {
                            include: {
                                documentDefinitions: { orderBy: { order: 'asc' } },
                                approvalStages: { orderBy: { order: 'asc' } },
                            },
                        },
                        questionnairePlan: {
                            include: { questions: { orderBy: { order: 'asc' } } },
                        },
                    },
                },
                properties: {
                    include: {
                        property: true,
                    },
                },
            },
        });

        if (!method) {
            throw new AppError(404, 'Payment method not found');
        }

        return method;
    }

    async function update(id: string, data: UpdatePaymentMethodInput) {
        await findById(id);

        const { phases, ...methodData } = data;

        const updated = await prisma.propertyPaymentMethod.update({
            where: { id },
            data: methodData,
        });

        return findById(updated.id);
    }

    async function deleteMethod(id: string) {
        await findById(id);

        const applicationCount = await prisma.application.count({
            where: { paymentMethodId: id },
        });

        if (applicationCount > 0) {
            throw new AppError(400, `Cannot delete payment method: used by ${applicationCount} application(s)`);
        }

        await prisma.$transaction(async (tx: any) => {
            await tx.propertyPaymentMethodPhase.deleteMany({
                where: { paymentMethodId: id },
            });

            await tx.propertyPaymentMethodLink.deleteMany({
                where: { paymentMethodId: id },
            });

            await tx.propertyPaymentMethod.delete({
                where: { id },
            });
        });

        return { success: true };
    }

    async function addPhase(methodId: string, data: AddPhaseInput) {
        const method = await findById(methodId);

        if (data.phaseCategory === 'PAYMENT' && !data.paymentPlanId) {
            throw new AppError(400, 'PAYMENT phases require paymentPlanId');
        }

        // Get existing phases to determine order
        const existingPhases = await prisma.propertyPaymentMethodPhase.findMany({
            where: { paymentMethodId: methodId },
            select: { order: true },
            orderBy: { order: 'desc' },
        });

        // Auto-assign next order if not provided
        let phaseOrder = data.order;
        if (phaseOrder === undefined || phaseOrder === null) {
            phaseOrder = existingPhases.length > 0 ? existingPhases[0].order + 1 : 1;
        } else {
            // Validate that the order is the next sequential number
            const maxOrder = existingPhases.length > 0 ? existingPhases[0].order : 0;
            if (phaseOrder !== maxOrder + 1) {
                throw new AppError(
                    400,
                    `Phase order must be ${maxOrder + 1} (next sequential). Got: ${phaseOrder}`
                );
            }
        }

        // For DOCUMENTATION phases, either documentationPlanId or inline stepDefinitions should be provided
        let stepDefinitionsToUse = data.stepDefinitions;
        let requiredDocumentTypesToUse = data.requiredDocuments;

        // If documentationPlanId is provided, fetch the plan and use its document definitions
        if (data.phaseCategory === 'DOCUMENTATION' && data.documentationPlanId) {
            const docPlan = await prisma.documentationPlan.findUnique({
                where: { id: data.documentationPlanId },
                include: {
                    documentDefinitions: { orderBy: { order: 'asc' } },
                    approvalStages: { orderBy: { order: 'asc' } },
                },
            });

            if (!docPlan) {
                throw new AppError(404, `Documentation plan "${data.documentationPlanId}" not found`);
            }

            // Document definitions are now used instead of steps
            // The ApprovalWorkflowService will use these at runtime
        }

        // Store snapshots for audit (now using document definitions instead of step definitions)
        const stepDefinitionsSnapshot = null; // Steps are deprecated
        const requiredDocumentSnapshot = requiredDocumentTypesToUse ? requiredDocumentTypesToUse : null;

        const phase = await prisma.$transaction(async (tx: any) => {
            const createdPhase = await tx.propertyPaymentMethodPhase.create({
                data: {
                    tenantId: method.tenantId,
                    paymentMethodId: methodId,
                    paymentPlanId: data.paymentPlanId,
                    documentationPlanId: data.documentationPlanId,
                    name: data.name,
                    description: data.description,
                    phaseCategory: data.phaseCategory,
                    phaseType: data.phaseType as PhaseType,
                    order: phaseOrder,
                    interestRate: data.interestRate,
                    percentOfPrice: data.percentOfPrice,
                    requiresPreviousPhaseCompletion: data.requiresPreviousPhaseCompletion ?? true,
                    minimumCompletionPercentage: data.minimumCompletionPercentage,
                    lockUnitOnComplete: data.lockUnitOnComplete ?? false,
                    stepDefinitionsSnapshot,
                    requiredDocumentSnapshot,
                },
            });

            // Create step child records
            if (stepDefinitionsToUse && stepDefinitionsToUse.length > 0) {
                for (const step of stepDefinitionsToUse) {
                    await tx.paymentMethodPhaseStep.create({
                        data: {
                            tenantId: method.tenantId,
                            phaseId: createdPhase.id,
                            name: step.name,
                            stepType: step.stepType as StepType,
                            order: step.order,
                            metadata: step.metadata,
                        },
                    });
                }
            }

            // Create required document child records
            if (requiredDocumentTypesToUse && requiredDocumentTypesToUse.length > 0) {
                for (const doc of requiredDocumentTypesToUse) {
                    await tx.paymentMethodPhaseDocument.create({
                        data: {
                            tenantId: method.tenantId,
                            phaseId: createdPhase.id,
                            documentType: doc.documentType,
                            isRequired: doc.isRequired ?? true,
                            description: doc.description,
                            allowedMimeTypes: doc.allowedMimeTypes?.join(','),
                            maxSizeBytes: doc.maxSizeBytes,
                            metadata: doc.metadata,
                        },
                    });
                }
            }

            return createdPhase;
        });

        return prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phase.id },
            include: {
                paymentPlan: true,
                documentationPlan: {
                    include: {
                        documentDefinitions: { orderBy: { order: 'asc' } },
                        approvalStages: { orderBy: { order: 'asc' } },
                    },
                },
            },
        });
    }

    async function updatePhase(phaseId: string, data: Partial<AddPhaseInput>) {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        // Extract child data
        const { requiredDocuments, stepDefinitions, phaseType, ...rest } = data;
        const updateData: Record<string, any> = { ...rest };

        // Add phaseType if provided (as enum)
        if (phaseType !== undefined) {
            updateData.phaseType = phaseType;
        }

        // Update snapshots if new data is provided
        if (stepDefinitions !== undefined) {
            updateData.stepDefinitionsSnapshot = stepDefinitions;
        }
        if (requiredDocuments !== undefined) {
            updateData.requiredDocumentSnapshot = requiredDocuments;
        }

        const updated = await prisma.$transaction(async (tx: any) => {
            const updatedPhase = await tx.propertyPaymentMethodPhase.update({
                where: { id: phaseId },
                data: updateData,
            });

            // Replace step child records if provided
            if (stepDefinitions !== undefined) {
                await tx.paymentMethodPhaseStep.deleteMany({ where: { phaseId } });
                if (stepDefinitions && stepDefinitions.length > 0) {
                    for (const step of stepDefinitions) {
                        await tx.paymentMethodPhaseStep.create({
                            data: {
                                tenantId: phase.tenantId,
                                phaseId,
                                name: step.name,
                                stepType: step.stepType as StepType,
                                order: step.order,
                                metadata: step.metadata,
                            },
                        });
                    }
                }
            }

            // Replace required document child records if provided
            if (requiredDocuments !== undefined) {
                await tx.paymentMethodPhaseDocument.deleteMany({ where: { phaseId } });
                if (requiredDocuments && requiredDocuments.length > 0) {
                    for (const doc of requiredDocuments) {
                        await tx.paymentMethodPhaseDocument.create({
                            data: {
                                tenantId: phase.tenantId,
                                phaseId,
                                documentType: doc.documentType,
                                isRequired: doc.isRequired ?? true,
                                description: doc.description,
                                allowedMimeTypes: doc.allowedMimeTypes?.join(','),
                                maxSizeBytes: doc.maxSizeBytes,
                                metadata: doc.metadata,
                            },
                        });
                    }
                }
            }

            return updatedPhase;
        });

        return prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: updated.id },
            include: {
                paymentPlan: true,
                steps: {
                    orderBy: { order: 'asc' },
                },
                requiredDocuments: true,
            },
        });
    }

    async function deletePhase(phaseId: string) {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        await prisma.$transaction(async (tx: any) => {
            // Delete the phase
            await tx.propertyPaymentMethodPhase.delete({
                where: { id: phaseId },
            });

            // Get remaining phases and reorder to close the gap
            const remainingPhases = await tx.propertyPaymentMethodPhase.findMany({
                where: { paymentMethodId: phase.paymentMethodId },
                orderBy: { order: 'asc' },
                select: { id: true, order: true },
            });

            // Reorder remaining phases to be sequential starting from 1
            for (let i = 0; i < remainingPhases.length; i++) {
                const newOrder = i + 1;
                if (remainingPhases[i].order !== newOrder) {
                    await tx.propertyPaymentMethodPhase.update({
                        where: { id: remainingPhases[i].id },
                        data: { order: newOrder },
                    });
                }
            }
        });

        return { success: true };
    }

    async function reorderPhases(methodId: string, phaseOrders: { phaseId: string; order: number }[]) {
        const method = await findById(methodId);

        // Get all phases for this payment method
        const existingPhases = await prisma.propertyPaymentMethodPhase.findMany({
            where: { paymentMethodId: methodId },
            select: { id: true },
        });

        // Validate all phases are included
        const existingPhaseIds = new Set(existingPhases.map(p => p.id));
        const providedPhaseIds = new Set(phaseOrders.map(p => p.phaseId));

        if (existingPhaseIds.size !== providedPhaseIds.size) {
            throw new AppError(400, `All ${existingPhaseIds.size} phases must be included in reorder request`);
        }

        for (const phaseId of providedPhaseIds) {
            if (!existingPhaseIds.has(phaseId)) {
                throw new AppError(400, `Phase ${phaseId} does not belong to this payment method`);
            }
        }

        // Validate orders are sequential starting from 1
        const orders = phaseOrders.map(p => p.order).sort((a, b) => a - b);
        for (let i = 0; i < orders.length; i++) {
            if (orders[i] !== i + 1) {
                throw new AppError(400, `Phase orders must be sequential starting from 1 (got: ${orders.join(', ')})`);
            }
        }

        // Check for duplicate orders
        const orderSet = new Set(orders);
        if (orderSet.size !== orders.length) {
            throw new AppError(400, 'Duplicate phase orders are not allowed');
        }

        await prisma.$transaction(async (tx: any) => {
            // Temporarily set all orders to negative to avoid unique constraint conflicts during reorder
            for (let i = 0; i < phaseOrders.length; i++) {
                await tx.propertyPaymentMethodPhase.update({
                    where: { id: phaseOrders[i].phaseId },
                    data: { order: -(i + 1) },
                });
            }

            // Now set the actual orders
            for (const { phaseId, order } of phaseOrders) {
                await tx.propertyPaymentMethodPhase.update({
                    where: { id: phaseId },
                    data: { order },
                });
            }
        });

        return findById(methodId);
    }

    // ============================================================
    // Step CRUD Operations
    // ============================================================

    async function addStep(phaseId: string, data: AddStepInput) {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        // Get existing steps to determine order
        const existingSteps = await prisma.paymentMethodPhaseStep.findMany({
            where: { phaseId },
            select: { order: true },
            orderBy: { order: 'desc' },
        });

        // Auto-assign next order if not provided
        let stepOrder = data.order;
        if (stepOrder === undefined || stepOrder === null) {
            stepOrder = existingSteps.length > 0 ? existingSteps[0].order + 1 : 1;
        } else {
            // Validate that the order is the next sequential number
            const maxOrder = existingSteps.length > 0 ? existingSteps[0].order : 0;
            if (stepOrder !== maxOrder + 1) {
                throw new AppError(
                    400,
                    `Step order must be ${maxOrder + 1} (next sequential). Got: ${stepOrder}`
                );
            }
        }

        const step = await prisma.paymentMethodPhaseStep.create({
            data: {
                tenantId: phase.tenantId,
                phaseId,
                name: data.name,
                stepType: data.stepType as StepType,
                order: stepOrder,
                metadata: data.metadata,
            },
        });

        // Update the phase snapshot for audit
        await updatePhaseStepSnapshot(phaseId);

        return step;
    }

    async function updateStep(stepId: string, data: UpdateStepInput) {
        const step = await prisma.paymentMethodPhaseStep.findUnique({
            where: { id: stepId },
        });

        if (!step) {
            throw new AppError(404, 'Step not found');
        }

        const updateData: Record<string, any> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.stepType !== undefined) updateData.stepType = data.stepType as StepType;
        if (data.order !== undefined) updateData.order = data.order;
        if (data.metadata !== undefined) updateData.metadata = data.metadata;

        const updated = await prisma.paymentMethodPhaseStep.update({
            where: { id: stepId },
            data: updateData,
        });

        // Update the phase snapshot for audit
        await updatePhaseStepSnapshot(step.phaseId);

        return updated;
    }

    async function deleteStep(stepId: string) {
        const step = await prisma.paymentMethodPhaseStep.findUnique({
            where: { id: stepId },
        });

        if (!step) {
            throw new AppError(404, 'Step not found');
        }

        const phaseId = step.phaseId;

        await prisma.$transaction(async (tx: any) => {
            // Delete the step
            await tx.paymentMethodPhaseStep.delete({
                where: { id: stepId },
            });

            // Get remaining steps and reorder to close the gap
            const remainingSteps = await tx.paymentMethodPhaseStep.findMany({
                where: { phaseId },
                orderBy: { order: 'asc' },
                select: { id: true, order: true },
            });

            // Reorder remaining steps to be sequential starting from 1
            for (let i = 0; i < remainingSteps.length; i++) {
                const newOrder = i + 1;
                if (remainingSteps[i].order !== newOrder) {
                    await tx.paymentMethodPhaseStep.update({
                        where: { id: remainingSteps[i].id },
                        data: { order: newOrder },
                    });
                }
            }
        });

        // Update the phase snapshot for audit
        await updatePhaseStepSnapshot(phaseId);

        return { success: true };
    }

    async function reorderSteps(phaseId: string, stepOrders: { stepId: string; order: number }[]) {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        // Get all steps for this phase
        const existingSteps = await prisma.paymentMethodPhaseStep.findMany({
            where: { phaseId },
            select: { id: true },
        });

        // Validate all steps are included
        const existingStepIds = new Set(existingSteps.map(s => s.id));
        const providedStepIds = new Set(stepOrders.map(s => s.stepId));

        if (existingStepIds.size !== providedStepIds.size) {
            throw new AppError(400, `All ${existingStepIds.size} steps must be included in reorder request`);
        }

        for (const stepId of providedStepIds) {
            if (!existingStepIds.has(stepId)) {
                throw new AppError(400, `Step ${stepId} does not belong to this phase`);
            }
        }

        // Validate orders are sequential starting from 1
        const orders = stepOrders.map(s => s.order).sort((a, b) => a - b);
        for (let i = 0; i < orders.length; i++) {
            if (orders[i] !== i + 1) {
                throw new AppError(400, `Step orders must be sequential starting from 1 (got: ${orders.join(', ')})`);
            }
        }

        // Check for duplicate orders
        const orderSet = new Set(orders);
        if (orderSet.size !== orders.length) {
            throw new AppError(400, 'Duplicate step orders are not allowed');
        }

        await prisma.$transaction(async (tx: any) => {
            // Temporarily set all orders to negative to avoid unique constraint conflicts
            for (let i = 0; i < stepOrders.length; i++) {
                await tx.paymentMethodPhaseStep.update({
                    where: { id: stepOrders[i].stepId },
                    data: { order: -(i + 1) },
                });
            }

            // Now set the actual orders
            for (const { stepId, order } of stepOrders) {
                await tx.paymentMethodPhaseStep.update({
                    where: { id: stepId },
                    data: { order },
                });
            }
        });

        // Update the phase snapshot for audit
        await updatePhaseStepSnapshot(phaseId);

        return prisma.paymentMethodPhaseStep.findMany({
            where: { phaseId },
            orderBy: { order: 'asc' },
        });
    }

    // Helper to update the phase's stepDefinitionsSnapshot after step changes
    async function updatePhaseStepSnapshot(phaseId: string) {
        const steps = await prisma.paymentMethodPhaseStep.findMany({
            where: { phaseId },
            orderBy: { order: 'asc' },
        });

        const snapshot = steps.map((s: any) => ({
            name: s.name,
            stepType: s.stepType,
            order: s.order,
            metadata: s.metadata,
        }));

        await prisma.propertyPaymentMethodPhase.update({
            where: { id: phaseId },
            data: { stepDefinitionsSnapshot: snapshot },
        });
    }

    // ============================================================
    // Document Requirement CRUD Operations
    // ============================================================

    async function addDocumentRequirement(phaseId: string, data: AddDocumentRequirementInput) {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        const doc = await prisma.paymentMethodPhaseDocument.create({
            data: {
                tenantId: phase.tenantId,
                phaseId,
                documentType: data.documentType,
                isRequired: data.isRequired ?? true,
                description: data.description,
                allowedMimeTypes: data.allowedMimeTypes?.join(','),
                maxSizeBytes: data.maxSizeBytes,
                metadata: data.metadata,
            },
        });

        // Update the phase snapshot for audit
        await updatePhaseDocumentSnapshot(phaseId);

        return doc;
    }

    async function updateDocumentRequirement(documentId: string, data: UpdateDocumentRequirementInput) {
        const doc = await prisma.paymentMethodPhaseDocument.findUnique({
            where: { id: documentId },
        });

        if (!doc) {
            throw new AppError(404, 'Document requirement not found');
        }

        const updateData: Record<string, any> = {};
        if (data.documentType !== undefined) updateData.documentType = data.documentType;
        if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.allowedMimeTypes !== undefined) updateData.allowedMimeTypes = data.allowedMimeTypes.join(',');
        if (data.maxSizeBytes !== undefined) updateData.maxSizeBytes = data.maxSizeBytes;
        if (data.metadata !== undefined) updateData.metadata = data.metadata;

        const updated = await prisma.paymentMethodPhaseDocument.update({
            where: { id: documentId },
            data: updateData,
        });

        // Update the phase snapshot for audit
        await updatePhaseDocumentSnapshot(doc.phaseId);

        return updated;
    }

    async function deleteDocumentRequirement(documentId: string) {
        const doc = await prisma.paymentMethodPhaseDocument.findUnique({
            where: { id: documentId },
        });

        if (!doc) {
            throw new AppError(404, 'Document requirement not found');
        }

        await prisma.paymentMethodPhaseDocument.delete({
            where: { id: documentId },
        });

        // Update the phase snapshot for audit
        await updatePhaseDocumentSnapshot(doc.phaseId);

        return { success: true };
    }

    // Helper to update the phase's requiredDocumentSnapshot after doc changes
    async function updatePhaseDocumentSnapshot(phaseId: string) {
        const docs = await prisma.paymentMethodPhaseDocument.findMany({
            where: { phaseId },
        });

        const snapshot = docs.map((d: any) => ({
            documentType: d.documentType,
            isRequired: d.isRequired,
            description: d.description,
            allowedMimeTypes: d.allowedMimeTypes?.split(','),
            maxSizeBytes: d.maxSizeBytes,
            metadata: d.metadata,
        }));

        await prisma.propertyPaymentMethodPhase.update({
            where: { id: phaseId },
            data: { requiredDocumentSnapshot: snapshot },
        });
    }

    // ============================================================
    // Clone Template
    // ============================================================

    async function clone(id: string, tenantId: string, data: ClonePaymentMethodInput) {
        const source = await findById(id);

        const cloned = await prisma.$transaction(async (tx: any) => {
            // Create the new payment method
            const newMethod = await tx.propertyPaymentMethod.create({
                data: {
                    tenantId,
                    name: data.name,
                    description: data.description ?? source.description,
                    isActive: source.isActive,
                    allowEarlyPayoff: source.allowEarlyPayoff,
                    earlyPayoffPenaltyRate: source.earlyPayoffPenaltyRate,
                    autoActivatePhases: source.autoActivatePhases,
                    requiresManualApproval: source.requiresManualApproval,
                },
            });

            // Clone each phase
            for (const phase of source.phases) {
                const newPhase = await tx.propertyPaymentMethodPhase.create({
                    data: {
                        tenantId,
                        paymentMethodId: newMethod.id,
                        paymentPlanId: phase.paymentPlanId,
                        name: phase.name,
                        description: phase.description,
                        phaseCategory: phase.phaseCategory,
                        phaseType: phase.phaseType,
                        order: phase.order,
                        interestRate: phase.interestRate,
                        percentOfPrice: phase.percentOfPrice,
                        requiresPreviousPhaseCompletion: phase.requiresPreviousPhaseCompletion,
                        minimumCompletionPercentage: phase.minimumCompletionPercentage,
                        stepDefinitionsSnapshot: phase.stepDefinitionsSnapshot,
                        requiredDocumentSnapshot: phase.requiredDocumentSnapshot,
                    },
                });

                // Note: Steps and requiredDocuments are deprecated
                // Document definitions are now stored in DocumentationPlan
            }

            return newMethod;
        });

        return findById(cloned.id);
    }

    async function linkToProperty(methodId: string, data: LinkToPropertyInput) {
        const method = await findById(methodId);

        const property = await prisma.property.findUnique({
            where: { id: data.propertyId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        const link = await prisma.propertyPaymentMethodLink.upsert({
            where: {
                propertyId_paymentMethodId: {
                    propertyId: data.propertyId,
                    paymentMethodId: methodId,
                },
            },
            update: {
                isDefault: data.isDefault,
                isActive: data.isActive,
            },
            create: {
                tenantId: method.tenantId,
                propertyId: data.propertyId,
                paymentMethodId: methodId,
                isDefault: data.isDefault ?? false,
                isActive: data.isActive ?? true,
            },
        });

        return link;
    }

    async function unlinkFromProperty(methodId: string, propertyId: string) {
        await prisma.propertyPaymentMethodLink.delete({
            where: {
                propertyId_paymentMethodId: {
                    propertyId,
                    paymentMethodId: methodId,
                },
            },
        });

        return { success: true };
    }

    async function getMethodsForProperty(propertyId: string) {
        const links = await prisma.propertyPaymentMethodLink.findMany({
            where: {
                propertyId,
                isActive: true,
            },
            include: {
                paymentMethod: {
                    include: {
                        phases: {
                            orderBy: { order: 'asc' },
                            include: {
                                paymentPlan: true,
                                steps: {
                                    orderBy: { order: 'asc' },
                                },
                                requiredDocuments: true,
                            },
                        },
                    },
                },
            },
        });

        return links;
    }

    // ============================================================
    // Phase Event Attachments
    // ============================================================

    async function addPhaseEventAttachment(phaseId: string, data: AddPhaseEventAttachmentInput) {
        // Verify phase exists
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseId },
        });

        if (!phase) {
            throw new AppError(404, 'Phase not found');
        }

        // Verify handler exists
        const handler = await prisma.eventHandler.findUnique({
            where: { id: data.handlerId },
        });

        if (!handler) {
            throw new AppError(404, 'Event handler not found');
        }

        const attachment = await prisma.phaseEventAttachment.create({
            data: {
                tenantId: phase.tenantId,
                phaseId,
                handlerId: data.handlerId,
                trigger: data.trigger as PhaseTrigger,
                priority: data.priority ?? 100,
                enabled: data.enabled ?? true,
            },
            include: {
                handler: true,
            },
        });

        return attachment;
    }

    async function getPhaseEventAttachments(phaseId: string) {
        const attachments = await prisma.phaseEventAttachment.findMany({
            where: { phaseId },
            include: {
                handler: {
                    include: {
                        eventType: true,
                    },
                },
            },
            orderBy: { priority: 'asc' },
        });

        return attachments;
    }

    async function updatePhaseEventAttachment(attachmentId: string, data: UpdatePhaseEventAttachmentInput) {
        const attachment = await prisma.phaseEventAttachment.findUnique({
            where: { id: attachmentId },
        });

        if (!attachment) {
            throw new AppError(404, 'Phase event attachment not found');
        }

        // If changing handler, verify it exists
        if (data.handlerId) {
            const handler = await prisma.eventHandler.findUnique({
                where: { id: data.handlerId },
            });

            if (!handler) {
                throw new AppError(404, 'Event handler not found');
            }
        }

        const updated = await prisma.phaseEventAttachment.update({
            where: { id: attachmentId },
            data: {
                ...(data.trigger && { trigger: data.trigger as PhaseTrigger }),
                ...(data.handlerId && { handlerId: data.handlerId }),
                ...(data.priority !== undefined && { priority: data.priority }),
                ...(data.enabled !== undefined && { enabled: data.enabled }),
            },
            include: {
                handler: true,
            },
        });

        return updated;
    }

    async function deletePhaseEventAttachment(attachmentId: string) {
        const attachment = await prisma.phaseEventAttachment.findUnique({
            where: { id: attachmentId },
        });

        if (!attachment) {
            throw new AppError(404, 'Phase event attachment not found');
        }

        await prisma.phaseEventAttachment.delete({
            where: { id: attachmentId },
        });

        return { success: true };
    }

    // ============================================================
    // Step Event Attachments
    // ============================================================

    async function addStepEventAttachment(stepId: string, data: AddStepEventAttachmentInput) {
        // Verify step exists
        const step = await prisma.paymentMethodPhaseStep.findUnique({
            where: { id: stepId },
        });

        if (!step) {
            throw new AppError(404, 'Step not found');
        }

        // Verify handler exists
        const handler = await prisma.eventHandler.findUnique({
            where: { id: data.handlerId },
        });

        if (!handler) {
            throw new AppError(404, 'Event handler not found');
        }

        const attachment = await prisma.stepEventAttachment.create({
            data: {
                tenantId: step.tenantId,
                stepId,
                handlerId: data.handlerId,
                trigger: data.trigger as StepTrigger,
                priority: data.priority ?? 100,
                enabled: data.enabled ?? true,
            },
            include: {
                handler: true,
            },
        });

        return attachment;
    }

    async function getStepEventAttachments(stepId: string) {
        const attachments = await prisma.stepEventAttachment.findMany({
            where: { stepId },
            include: {
                handler: {
                    include: {
                        eventType: true,
                    },
                },
            },
            orderBy: { priority: 'asc' },
        });

        return attachments;
    }

    async function updateStepEventAttachment(attachmentId: string, data: UpdateStepEventAttachmentInput) {
        const attachment = await prisma.stepEventAttachment.findUnique({
            where: { id: attachmentId },
        });

        if (!attachment) {
            throw new AppError(404, 'Step event attachment not found');
        }

        // If changing handler, verify it exists
        if (data.handlerId) {
            const handler = await prisma.eventHandler.findUnique({
                where: { id: data.handlerId },
            });

            if (!handler) {
                throw new AppError(404, 'Event handler not found');
            }
        }

        const updated = await prisma.stepEventAttachment.update({
            where: { id: attachmentId },
            data: {
                ...(data.trigger && { trigger: data.trigger as StepTrigger }),
                ...(data.handlerId && { handlerId: data.handlerId }),
                ...(data.priority !== undefined && { priority: data.priority }),
                ...(data.enabled !== undefined && { enabled: data.enabled }),
            },
            include: {
                handler: true,
            },
        });

        return updated;
    }

    async function deleteStepEventAttachment(attachmentId: string) {
        const attachment = await prisma.stepEventAttachment.findUnique({
            where: { id: attachmentId },
        });

        if (!attachment) {
            throw new AppError(404, 'Step event attachment not found');
        }

        await prisma.stepEventAttachment.delete({
            where: { id: attachmentId },
        });

        return { success: true };
    }

    return {
        create,
        findAll,
        findById,
        update,
        delete: deleteMethod,
        clone,
        addPhase,
        updatePhase,
        deletePhase,
        reorderPhases,
        // Step CRUD
        addStep,
        updateStep,
        deleteStep,
        reorderSteps,
        // Document requirement CRUD
        addDocumentRequirement,
        updateDocumentRequirement,
        deleteDocumentRequirement,
        // Property linking
        linkToProperty,
        unlinkFromProperty,
        getMethodsForProperty,
        // Phase event attachments
        addPhaseEventAttachment,
        getPhaseEventAttachments,
        updatePhaseEventAttachment,
        deletePhaseEventAttachment,
        // Step event attachments
        addStepEventAttachment,
        getStepEventAttachments,
        updateStepEventAttachment,
        deleteStepEventAttachment,
    };
}

// Default instance for backward compatibility
export const paymentMethodService: PaymentMethodService = createPaymentMethodService();
