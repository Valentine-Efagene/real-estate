import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import type { CreateDocumentationPlanInput, UpdateDocumentationPlanInput, AddStepToPlanInput } from '../validators/documentation-plan.validator';

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
    addStep(planId: string, data: AddStepToPlanInput): Promise<any>;
    removeStep(planId: string, stepId: string): Promise<{ success: boolean }>;
    updateStep(planId: string, stepId: string, data: Partial<AddStepToPlanInput>): Promise<any>;
}

/**
 * Create a documentation plan service with the given Prisma client.
 * Use this for tenant-scoped operations.
 */
export function createDocumentationPlanService(prisma: AnyPrismaClient = defaultPrisma): DocumentationPlanService {
    async function create(tenantId: string, data: CreateDocumentationPlanInput) {
        // Validate steps have unique orders
        const orders = data.steps.map(s => s.order);
        if (new Set(orders).size !== orders.length) {
            throw new AppError(400, 'Step orders must be unique');
        }

        const plan = await prisma.documentationPlan.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                isActive: data.isActive ?? true,
                requiredDocumentTypes: data.requiredDocumentTypes ?? [],
                steps: {
                    create: data.steps.map(step => ({
                        name: step.name,
                        stepType: step.stepType,
                        order: step.order,
                        documentType: step.documentType,
                        metadata: step.metadata,
                        // Document validation rules
                        isRequired: step.isRequired ?? true,
                        description: step.description,
                        maxSizeBytes: step.maxSizeBytes,
                        allowedMimeTypes: step.allowedMimeTypes?.join(','),
                        expiryDays: step.expiryDays,
                        requiresManualReview: step.requiresManualReview ?? false,
                        minFiles: step.minFiles ?? 1,
                        maxFiles: step.maxFiles ?? 1,
                    })),
                },
            },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        return plan;
    }

    async function findAll(filters?: { isActive?: boolean }) {
        const plans = await prisma.documentationPlan.findMany({
            where: filters,
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { name: 'asc' },
        });
        return plans;
    }

    async function findById(id: string) {
        const plan = await prisma.documentationPlan.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
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
                include: {
                    steps: {
                        orderBy: { order: 'asc' },
                    },
                },
            });
            return plan;
        }

        const plan = await prisma.documentationPlan.findUnique({
            where: { tenantId_name: { tenantId, name } },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
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
                requiredDocumentTypes: data.requiredDocumentTypes,
            },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
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
                requiredDocumentTypes: source.requiredDocumentTypes ?? undefined,
                steps: {
                    create: source.steps.map((step: any) => ({
                        name: step.name,
                        stepType: step.stepType,
                        order: step.order,
                        documentType: step.documentType,
                        metadata: step.metadata,
                        // Document validation rules
                        isRequired: step.isRequired,
                        description: step.description,
                        maxSizeBytes: step.maxSizeBytes,
                        allowedMimeTypes: step.allowedMimeTypes,
                        expiryDays: step.expiryDays,
                        requiresManualReview: step.requiresManualReview,
                        minFiles: step.minFiles,
                        maxFiles: step.maxFiles,
                    })),
                },
            },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        return cloned;
    }

    async function addStep(planId: string, data: AddStepToPlanInput) {
        await findById(planId);

        const step = await prisma.documentationPlanStep.create({
            data: {
                planId,
                name: data.name,
                stepType: data.stepType,
                order: data.order,
                documentType: data.documentType,
                metadata: data.metadata,
                // Document validation rules
                isRequired: data.isRequired ?? true,
                description: data.description,
                maxSizeBytes: data.maxSizeBytes,
                allowedMimeTypes: data.allowedMimeTypes?.join(','),
                expiryDays: data.expiryDays,
                requiresManualReview: data.requiresManualReview ?? false,
                minFiles: data.minFiles ?? 1,
                maxFiles: data.maxFiles ?? 1,
            },
        });

        return step;
    }

    async function removeStep(planId: string, stepId: string) {
        await findById(planId);

        const step = await prisma.documentationPlanStep.findUnique({
            where: { id: stepId },
        });

        if (!step || step.planId !== planId) {
            throw new AppError(404, 'Step not found in this plan');
        }

        await prisma.documentationPlanStep.delete({
            where: { id: stepId },
        });

        return { success: true };
    }

    async function updateStep(planId: string, stepId: string, data: Partial<AddStepToPlanInput>) {
        await findById(planId);

        const step = await prisma.documentationPlanStep.findUnique({
            where: { id: stepId },
        });

        if (!step || step.planId !== planId) {
            throw new AppError(404, 'Step not found in this plan');
        }

        const updated = await prisma.documentationPlanStep.update({
            where: { id: stepId },
            data: {
                name: data.name,
                stepType: data.stepType,
                order: data.order,
                documentType: data.documentType,
                metadata: data.metadata,
                // Document validation rules
                isRequired: data.isRequired,
                description: data.description,
                maxSizeBytes: data.maxSizeBytes,
                allowedMimeTypes: data.allowedMimeTypes?.join(','),
                expiryDays: data.expiryDays,
                requiresManualReview: data.requiresManualReview,
                minFiles: data.minFiles,
                maxFiles: data.maxFiles,
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
        addStep,
        removeStep,
        updateStep,
    };
}
