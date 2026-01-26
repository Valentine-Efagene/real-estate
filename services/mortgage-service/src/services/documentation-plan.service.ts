import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import type {
    CreateDocumentationPlanInput,
    UpdateDocumentationPlanInput,
    AddDocumentDefinitionInput,
    AddApprovalStageInput
} from '../validators/documentation-plan.validator';

type AnyPrismaClient = PrismaClient;

/**
 * DocumentationPlanService interface
 */
export interface DocumentationPlanService {
    create(tenantId: string, data: CreateDocumentationPlanInput): Promise<any>;
    findAll(filters?: { isActive?: boolean }): Promise<any[]>;
    findById(id: string): Promise<any>;
    findByName(tenantId: string | null, name: string): Promise<any>;
    update(id: string, data: UpdateDocumentationPlanInput): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
    clone(id: string, newName: string): Promise<any>;
    addDocumentDefinition(planId: string, data: AddDocumentDefinitionInput): Promise<any>;
    removeDocumentDefinition(planId: string, definitionId: string): Promise<{ success: boolean }>;
    updateDocumentDefinition(planId: string, definitionId: string, data: Partial<AddDocumentDefinitionInput>): Promise<any>;
    addApprovalStage(planId: string, data: AddApprovalStageInput): Promise<any>;
    removeApprovalStage(planId: string, stageId: string): Promise<{ success: boolean }>;
    updateApprovalStage(planId: string, stageId: string, data: Partial<AddApprovalStageInput>): Promise<any>;
}

/**
 * Create a documentation plan service with the given Prisma client.
 * Use this for tenant-scoped operations.
 */
export function createDocumentationPlanService(prisma: AnyPrismaClient = defaultPrisma): DocumentationPlanService {
    const includeRelations = {
        documentDefinitions: {
            orderBy: { order: 'asc' as const },
        },
        approvalStages: {
            orderBy: { order: 'asc' as const },
            include: {
                organizationType: {
                    select: { id: true, code: true, name: true },
                },
            },
        },
    };

    /**
     * Resolve organization type code to ID
     * For global templates (tenantId = null), we look for system-level organization types
     */
    async function resolveOrganizationTypeId(tenantId: string | null, code: string): Promise<string> {
        if (!tenantId) {
            // For global templates, look for system types (isSystemType = true)
            const orgType = await prisma.organizationType.findFirst({
                where: { code, isSystemType: true },
            });
            if (!orgType) {
                throw new AppError(400, `System organization type '${code}' not found`);
            }
            return orgType.id;
        }
        
        const orgType = await prisma.organizationType.findUnique({
            where: { tenantId_code: { tenantId, code } },
        });
        if (!orgType) {
            throw new AppError(400, `Organization type '${code}' not found for tenant`);
        }
        return orgType.id;
    }

    async function create(tenantId: string, data: CreateDocumentationPlanInput) {
        // Validate document definitions have unique orders
        const docOrders = data.documentDefinitions.map(d => d.order);
        if (new Set(docOrders).size !== docOrders.length) {
            throw new AppError(400, 'Document definition orders must be unique');
        }

        // Validate approval stages have unique orders
        const stageOrders = data.approvalStages.map(s => s.order);
        if (new Set(stageOrders).size !== stageOrders.length) {
            throw new AppError(400, 'Approval stage orders must be unique');
        }

        // Resolve organization type codes to IDs
        const resolvedStages = await Promise.all(
            data.approvalStages.map(async (stage) => ({
                ...stage,
                organizationTypeId: await resolveOrganizationTypeId(tenantId, stage.organizationTypeCode),
            }))
        );

        const plan = await prisma.documentationPlan.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                isActive: data.isActive ?? true,
                documentDefinitions: {
                    create: data.documentDefinitions.map(doc => ({
                        documentType: doc.documentType,
                        documentName: doc.documentName,
                        uploadedBy: doc.uploadedBy ?? 'CUSTOMER',
                        order: doc.order,
                        isRequired: doc.isRequired ?? true,
                        description: doc.description,
                        maxSizeBytes: doc.maxSizeBytes,
                        allowedMimeTypes: doc.allowedMimeTypes?.join(','),
                        expiryDays: doc.expiryDays,
                        minFiles: doc.minFiles ?? 1,
                        maxFiles: doc.maxFiles ?? 1,
                        condition: doc.condition,
                    })),
                },
                approvalStages: {
                    create: resolvedStages.map(stage => ({
                        name: stage.name,
                        order: stage.order,
                        organizationTypeId: stage.organizationTypeId,
                        autoTransition: stage.autoTransition ?? false,
                        waitForAllDocuments: stage.waitForAllDocuments ?? true,
                        allowEarlyVisibility: stage.allowEarlyVisibility ?? false,
                        onRejection: stage.onRejection ?? 'CASCADE_BACK',
                        restartFromStageOrder: stage.restartFromStageOrder,
                        slaHours: stage.slaHours,
                        description: stage.description,
                    })),
                },
            },
            include: includeRelations,
        });

        return plan;
    }

    async function findAll(filters?: { isActive?: boolean }) {
        const plans = await prisma.documentationPlan.findMany({
            where: filters,
            include: includeRelations,
            orderBy: { name: 'asc' },
        });
        return plans;
    }

    async function findById(id: string) {
        const plan = await prisma.documentationPlan.findUnique({
            where: { id },
            include: includeRelations,
        });

        if (!plan) {
            throw new AppError(404, 'Documentation plan not found');
        }

        return plan;
    }

    async function findByName(tenantId: string | null, name: string) {
        if (!tenantId) {
            const plan = await prisma.documentationPlan.findFirst({
                where: { name, tenantId: null },
                include: includeRelations,
            });
            return plan;
        }

        const plan = await prisma.documentationPlan.findUnique({
            where: { tenantId_name: { tenantId, name } },
            include: includeRelations,
        });

        return plan;
    }

    async function update(id: string, data: UpdateDocumentationPlanInput) {
        await findById(id);

        const updated = await prisma.documentationPlan.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                isActive: data.isActive,
            },
            include: includeRelations,
        });

        return updated;
    }

    async function deleteById(id: string) {
        await findById(id);

        // Check if plan is in use
        const usageCount = await prisma.propertyPaymentMethodPhase.count({
            where: { documentationPlanId: id },
        });

        if (usageCount > 0) {
            throw new AppError(400, `Cannot delete documentation plan: used by ${usageCount} payment method phase(s)`);
        }

        await prisma.documentationPlan.delete({
            where: { id },
        });

        return { success: true };
    }

    async function clone(id: string, newName: string) {
        const source = await findById(id);

        const cloned = await prisma.documentationPlan.create({
            data: {
                tenantId: source.tenantId,
                name: newName,
                description: source.description,
                isActive: source.isActive,
                documentDefinitions: {
                    create: source.documentDefinitions.map((doc: any) => ({
                        documentType: doc.documentType,
                        documentName: doc.documentName,
                        uploadedBy: doc.uploadedBy,
                        order: doc.order,
                        isRequired: doc.isRequired,
                        description: doc.description,
                        maxSizeBytes: doc.maxSizeBytes,
                        allowedMimeTypes: doc.allowedMimeTypes,
                        expiryDays: doc.expiryDays,
                        minFiles: doc.minFiles,
                        maxFiles: doc.maxFiles,
                        condition: doc.condition,
                    })),
                },
                approvalStages: {
                    create: source.approvalStages.map((stage: any) => ({
                        name: stage.name,
                        order: stage.order,
                        organizationTypeId: stage.organizationTypeId,
                        autoTransition: stage.autoTransition,
                        waitForAllDocuments: stage.waitForAllDocuments,
                        allowEarlyVisibility: stage.allowEarlyVisibility,
                        onRejection: stage.onRejection,
                        restartFromStageOrder: stage.restartFromStageOrder,
                        slaHours: stage.slaHours,
                        description: stage.description,
                    })),
                },
            },
            include: includeRelations,
        });

        return cloned;
    }

    // =========================================================================
    // DOCUMENT DEFINITION OPERATIONS
    // =========================================================================

    async function addDocumentDefinition(planId: string, data: AddDocumentDefinitionInput) {
        await findById(planId);

        const definition = await prisma.documentDefinition.create({
            data: {
                planId,
                documentType: data.documentType,
                documentName: data.documentName,
                uploadedBy: data.uploadedBy ?? 'CUSTOMER',
                order: data.order,
                isRequired: data.isRequired ?? true,
                description: data.description,
                maxSizeBytes: data.maxSizeBytes,
                allowedMimeTypes: data.allowedMimeTypes?.join(','),
                expiryDays: data.expiryDays,
                minFiles: data.minFiles ?? 1,
                maxFiles: data.maxFiles ?? 1,
                condition: data.condition,
            },
        });

        return definition;
    }

    async function removeDocumentDefinition(planId: string, definitionId: string) {
        await findById(planId);

        const definition = await prisma.documentDefinition.findUnique({
            where: { id: definitionId },
        });

        if (!definition || definition.planId !== planId) {
            throw new AppError(404, 'Document definition not found in this plan');
        }

        await prisma.documentDefinition.delete({
            where: { id: definitionId },
        });

        return { success: true };
    }

    async function updateDocumentDefinition(planId: string, definitionId: string, data: Partial<AddDocumentDefinitionInput>) {
        await findById(planId);

        const definition = await prisma.documentDefinition.findUnique({
            where: { id: definitionId },
        });

        if (!definition || definition.planId !== planId) {
            throw new AppError(404, 'Document definition not found in this plan');
        }

        const updated = await prisma.documentDefinition.update({
            where: { id: definitionId },
            data: {
                documentType: data.documentType,
                documentName: data.documentName,
                uploadedBy: data.uploadedBy,
                order: data.order,
                isRequired: data.isRequired,
                description: data.description,
                maxSizeBytes: data.maxSizeBytes,
                allowedMimeTypes: data.allowedMimeTypes?.join(','),
                expiryDays: data.expiryDays,
                minFiles: data.minFiles,
                maxFiles: data.maxFiles,
                condition: data.condition,
            },
        });

        return updated;
    }

    // =========================================================================
    // APPROVAL STAGE OPERATIONS
    // =========================================================================

    async function addApprovalStage(planId: string, data: AddApprovalStageInput) {
        const plan = await findById(planId);

        // Resolve organization type code to ID
        const organizationTypeId = await resolveOrganizationTypeId(plan.tenantId, data.organizationTypeCode);

        const stage = await prisma.approvalStage.create({
            data: {
                planId,
                name: data.name,
                order: data.order,
                organizationTypeId,
                autoTransition: data.autoTransition ?? false,
                waitForAllDocuments: data.waitForAllDocuments ?? true,
                allowEarlyVisibility: data.allowEarlyVisibility ?? false,
                onRejection: data.onRejection ?? 'CASCADE_BACK',
                restartFromStageOrder: data.restartFromStageOrder,
                slaHours: data.slaHours,
                description: data.description,
            },
            include: {
                organizationType: {
                    select: { id: true, code: true, name: true },
                },
            },
        });

        return stage;
    }

    async function removeApprovalStage(planId: string, stageId: string) {
        await findById(planId);

        const stage = await prisma.approvalStage.findUnique({
            where: { id: stageId },
        });

        if (!stage || stage.planId !== planId) {
            throw new AppError(404, 'Approval stage not found in this plan');
        }

        await prisma.approvalStage.delete({
            where: { id: stageId },
        });

        return { success: true };
    }

    async function updateApprovalStage(planId: string, stageId: string, data: Partial<AddApprovalStageInput>) {
        const plan = await findById(planId);

        const stage = await prisma.approvalStage.findUnique({
            where: { id: stageId },
        });

        if (!stage || stage.planId !== planId) {
            throw new AppError(404, 'Approval stage not found in this plan');
        }

        // Resolve organization type code to ID if provided
        let organizationTypeId: string | undefined;
        if (data.organizationTypeCode) {
            organizationTypeId = await resolveOrganizationTypeId(plan.tenantId, data.organizationTypeCode);
        }

        const updated = await prisma.approvalStage.update({
            where: { id: stageId },
            data: {
                name: data.name,
                order: data.order,
                organizationTypeId,
                autoTransition: data.autoTransition,
                waitForAllDocuments: data.waitForAllDocuments,
                allowEarlyVisibility: data.allowEarlyVisibility,
                onRejection: data.onRejection,
                restartFromStageOrder: data.restartFromStageOrder,
                slaHours: data.slaHours,
                description: data.description,
            },
            include: {
                organizationType: {
                    select: { id: true, code: true, name: true },
                },
            },
        });

        return updated;
    }

    return {
        create,
        findAll,
        findById,
        findByName,
        update,
        delete: deleteById,
        clone,
        addDocumentDefinition,
        removeDocumentDefinition,
        updateDocumentDefinition,
        addApprovalStage,
        removeApprovalStage,
        updateApprovalStage,
    };
}
