import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    ConflictError,
    ValidationError,
    Prisma,
} from '@valentine-efagene/qshelter-common';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateOnboardingFlowInput {
    name: string;
    description?: string;
    isActive?: boolean;
    autoActivatePhases?: boolean;
    expiresInDays?: number | null;
}

export interface UpdateOnboardingFlowInput {
    name?: string;
    description?: string;
    isActive?: boolean;
    autoActivatePhases?: boolean;
    expiresInDays?: number | null;
}

export interface AddFlowPhaseInput {
    name: string;
    description?: string;
    phaseCategory: 'QUESTIONNAIRE' | 'DOCUMENTATION' | 'GATE';
    phaseType: string;
    order: number;
    requiresPreviousPhaseCompletion?: boolean;
    questionnairePlanId?: string;
    documentationPlanId?: string;
    gatePlanId?: string;
}

export interface UpdateFlowPhaseInput {
    name?: string;
    description?: string;
    phaseType?: string;
    order?: number;
    requiresPreviousPhaseCompletion?: boolean;
    questionnairePlanId?: string | null;
    documentationPlanId?: string | null;
    gatePlanId?: string | null;
}

export interface LinkToOrgTypeInput {
    organizationTypeId: string;
}

// =============================================================================
// STANDARD INCLUDE
// =============================================================================

const flowDetailInclude = {
    phases: {
        orderBy: { order: 'asc' as const },
        include: {
            questionnairePlan: { select: { id: true, name: true, description: true, isActive: true } },
            documentationPlan: { select: { id: true, name: true, description: true, isActive: true } },
            gatePlan: { select: { id: true, name: true, description: true, isActive: true, requiredApprovals: true } },
        },
    },
    organizationTypes: {
        select: { id: true, code: true, name: true },
    },
    _count: {
        select: { onboardings: true },
    },
};

// =============================================================================
// SERVICE
// =============================================================================

class OnboardingFlowService {
    /**
     * List all onboarding flows for a tenant.
     */
    async list(tenantId: string) {
        return prisma.onboardingFlow.findMany({
            where: { tenantId },
            include: flowDetailInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a single onboarding flow by ID.
     */
    async findById(tenantId: string, id: string) {
        const flow = await prisma.onboardingFlow.findFirst({
            where: { id, tenantId },
            include: flowDetailInclude,
        });
        if (!flow) throw new NotFoundError('Onboarding flow not found');
        return flow;
    }

    /**
     * Create a new onboarding flow.
     */
    async create(tenantId: string, data: CreateOnboardingFlowInput) {
        // Check for duplicate name
        const existing = await prisma.onboardingFlow.findFirst({
            where: { tenantId, name: data.name },
        });
        if (existing) {
            throw new ConflictError(`Onboarding flow "${data.name}" already exists`);
        }

        return prisma.onboardingFlow.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                isActive: data.isActive ?? true,
                autoActivatePhases: data.autoActivatePhases ?? true,
                expiresInDays: data.expiresInDays ?? 30,
            },
            include: flowDetailInclude,
        });
    }

    /**
     * Update an onboarding flow.
     */
    async update(tenantId: string, id: string, data: UpdateOnboardingFlowInput) {
        const flow = await prisma.onboardingFlow.findFirst({
            where: { id, tenantId },
        });
        if (!flow) throw new NotFoundError('Onboarding flow not found');

        // Check for name conflict
        if (data.name && data.name !== flow.name) {
            const dup = await prisma.onboardingFlow.findFirst({
                where: { tenantId, name: data.name, id: { not: id } },
            });
            if (dup) throw new ConflictError(`Onboarding flow "${data.name}" already exists`);
        }

        return prisma.onboardingFlow.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                isActive: data.isActive,
                autoActivatePhases: data.autoActivatePhases,
                expiresInDays: data.expiresInDays,
            },
            include: flowDetailInclude,
        });
    }

    /**
     * Delete an onboarding flow. Fails if it has active onboarding instances.
     */
    async delete(tenantId: string, id: string) {
        const flow = await prisma.onboardingFlow.findFirst({
            where: { id, tenantId },
            include: { _count: { select: { onboardings: true } } },
        });
        if (!flow) throw new NotFoundError('Onboarding flow not found');

        if (flow._count.onboardings > 0) {
            throw new ValidationError(
                `Cannot delete: ${flow._count.onboardings} onboarding instance(s) use this flow. Deactivate it instead.`
            );
        }

        // Unlink from any org types first
        await prisma.organizationType.updateMany({
            where: { onboardingFlowId: id },
            data: { onboardingFlowId: null },
        });

        await prisma.onboardingFlow.delete({ where: { id } });
        return { deleted: true };
    }

    // =========================================================================
    // PHASES
    // =========================================================================

    /**
     * Add a phase to an onboarding flow.
     */
    async addPhase(tenantId: string, flowId: string, data: AddFlowPhaseInput) {
        const flow = await prisma.onboardingFlow.findFirst({
            where: { id: flowId, tenantId },
        });
        if (!flow) throw new NotFoundError('Onboarding flow not found');

        // Validate plan references based on phase category
        this.validatePhasePlanLinks(data.phaseCategory, data);

        return prisma.onboardingFlowPhase.create({
            data: {
                tenantId,
                onboardingFlowId: flowId,
                name: data.name,
                description: data.description,
                phaseCategory: data.phaseCategory,
                phaseType: data.phaseType as any,
                order: data.order,
                requiresPreviousPhaseCompletion: data.requiresPreviousPhaseCompletion ?? true,
                questionnairePlanId: data.phaseCategory === 'QUESTIONNAIRE' ? data.questionnairePlanId : null,
                documentationPlanId: data.phaseCategory === 'DOCUMENTATION' ? data.documentationPlanId : null,
                gatePlanId: data.phaseCategory === 'GATE' ? data.gatePlanId : null,
            },
            include: {
                questionnairePlan: { select: { id: true, name: true } },
                documentationPlan: { select: { id: true, name: true } },
                gatePlan: { select: { id: true, name: true } },
            },
        });
    }

    /**
     * Update a phase of an onboarding flow.
     */
    async updatePhase(tenantId: string, flowId: string, phaseId: string, data: UpdateFlowPhaseInput) {
        const phase = await prisma.onboardingFlowPhase.findFirst({
            where: { id: phaseId, onboardingFlowId: flowId, tenantId },
        });
        if (!phase) throw new NotFoundError('Onboarding flow phase not found');

        return prisma.onboardingFlowPhase.update({
            where: { id: phaseId },
            data: {
                name: data.name,
                description: data.description,
                phaseType: data.phaseType as any,
                order: data.order,
                requiresPreviousPhaseCompletion: data.requiresPreviousPhaseCompletion,
                questionnairePlanId: data.questionnairePlanId,
                documentationPlanId: data.documentationPlanId,
                gatePlanId: data.gatePlanId,
            },
            include: {
                questionnairePlan: { select: { id: true, name: true } },
                documentationPlan: { select: { id: true, name: true } },
                gatePlan: { select: { id: true, name: true } },
            },
        });
    }

    /**
     * Remove a phase from an onboarding flow.
     */
    async removePhase(tenantId: string, flowId: string, phaseId: string) {
        const phase = await prisma.onboardingFlowPhase.findFirst({
            where: { id: phaseId, onboardingFlowId: flowId, tenantId },
        });
        if (!phase) throw new NotFoundError('Onboarding flow phase not found');

        await prisma.onboardingFlowPhase.delete({ where: { id: phaseId } });
        return { deleted: true };
    }

    // =========================================================================
    // ORG TYPE LINKING
    // =========================================================================

    /**
     * Link this onboarding flow to an organization type.
     * An org type can only be linked to one onboarding flow at a time.
     */
    async linkToOrgType(tenantId: string, flowId: string, orgTypeId: string) {
        const flow = await prisma.onboardingFlow.findFirst({
            where: { id: flowId, tenantId },
        });
        if (!flow) throw new NotFoundError('Onboarding flow not found');

        const orgType = await prisma.organizationType.findFirst({
            where: { id: orgTypeId, tenantId },
        });
        if (!orgType) throw new NotFoundError('Organization type not found');

        if (orgType.onboardingFlowId && orgType.onboardingFlowId !== flowId) {
            throw new ConflictError(
                `Organization type "${orgType.code}" is already linked to another onboarding flow. Unlink it first.`
            );
        }

        await prisma.organizationType.update({
            where: { id: orgTypeId },
            data: { onboardingFlowId: flowId },
        });

        return this.findById(tenantId, flowId);
    }

    /**
     * Unlink an organization type from this onboarding flow.
     */
    async unlinkOrgType(tenantId: string, flowId: string, orgTypeId: string) {
        const orgType = await prisma.organizationType.findFirst({
            where: { id: orgTypeId, tenantId, onboardingFlowId: flowId },
        });
        if (!orgType) throw new NotFoundError('Organization type not linked to this flow');

        await prisma.organizationType.update({
            where: { id: orgTypeId },
            data: { onboardingFlowId: null },
        });

        return this.findById(tenantId, flowId);
    }

    // =========================================================================
    // AVAILABLE PLANS (for dropdowns in UI)
    // =========================================================================

    /**
     * List available questionnaire plans for the tenant (for linking to phases).
     */
    async listQuestionnairePlans(tenantId: string) {
        return prisma.questionnairePlan.findMany({
            where: { OR: [{ tenantId }, { tenantId: null }], isActive: true },
            select: { id: true, name: true, description: true, category: true },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * List available documentation plans for the tenant.
     */
    async listDocumentationPlans(tenantId: string) {
        return prisma.documentationPlan.findMany({
            where: { OR: [{ tenantId }, { tenantId: null }], isActive: true },
            select: { id: true, name: true, description: true },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * List available gate plans for the tenant.
     */
    async listGatePlans(tenantId: string) {
        return prisma.gatePlan.findMany({
            where: { OR: [{ tenantId }, { tenantId: null }], isActive: true },
            select: { id: true, name: true, description: true, requiredApprovals: true },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * List available organization types for linking.
     */
    async listOrgTypes(tenantId: string) {
        return prisma.organizationType.findMany({
            where: { tenantId },
            select: { id: true, code: true, name: true, onboardingFlowId: true },
            orderBy: { code: 'asc' },
        });
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private validatePhasePlanLinks(
        category: string,
        data: { questionnairePlanId?: string; documentationPlanId?: string; gatePlanId?: string },
    ) {
        switch (category) {
            case 'QUESTIONNAIRE':
                if (!data.questionnairePlanId) {
                    throw new ValidationError('questionnairePlanId is required for QUESTIONNAIRE phases');
                }
                break;
            case 'DOCUMENTATION':
                if (!data.documentationPlanId) {
                    throw new ValidationError('documentationPlanId is required for DOCUMENTATION phases');
                }
                break;
            case 'GATE':
                if (!data.gatePlanId) {
                    throw new ValidationError('gatePlanId is required for GATE phases');
                }
                break;
        }
    }
}

export const onboardingFlowService = new OnboardingFlowService();
