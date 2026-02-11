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

export interface CreateOnboardingMethodInput {
    name: string;
    description?: string;
    isActive?: boolean;
    autoActivatePhases?: boolean;
    expiresInDays?: number | null;
}

export interface UpdateOnboardingMethodInput {
    name?: string;
    description?: string;
    isActive?: boolean;
    autoActivatePhases?: boolean;
    expiresInDays?: number | null;
}

export interface AddMethodPhaseInput {
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

export interface UpdateMethodPhaseInput {
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

const methodDetailInclude = {
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

class OnboardingMethodService {
    /**
     * List all onboarding methods for a tenant.
     */
    async list(tenantId: string) {
        return prisma.onboardingMethod.findMany({
            where: { tenantId },
            include: methodDetailInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get a single onboarding method by ID.
     */
    async findById(tenantId: string, id: string) {
        const method = await prisma.onboardingMethod.findFirst({
            where: { id, tenantId },
            include: methodDetailInclude,
        });
        if (!method) throw new NotFoundError('Onboarding method not found');
        return method;
    }

    /**
     * Create a new onboarding method.
     */
    async create(tenantId: string, data: CreateOnboardingMethodInput) {
        // Check for duplicate name
        const existing = await prisma.onboardingMethod.findFirst({
            where: { tenantId, name: data.name },
        });
        if (existing) {
            throw new ConflictError(`Onboarding method "${data.name}" already exists`);
        }

        return prisma.onboardingMethod.create({
            data: {
                tenantId,
                name: data.name,
                description: data.description,
                isActive: data.isActive ?? true,
                autoActivatePhases: data.autoActivatePhases ?? true,
                expiresInDays: data.expiresInDays ?? 30,
            },
            include: methodDetailInclude,
        });
    }

    /**
     * Update an onboarding method.
     */
    async update(tenantId: string, id: string, data: UpdateOnboardingMethodInput) {
        const method = await prisma.onboardingMethod.findFirst({
            where: { id, tenantId },
        });
        if (!method) throw new NotFoundError('Onboarding method not found');

        // Check for name conflict
        if (data.name && data.name !== method.name) {
            const dup = await prisma.onboardingMethod.findFirst({
                where: { tenantId, name: data.name, id: { not: id } },
            });
            if (dup) throw new ConflictError(`Onboarding method "${data.name}" already exists`);
        }

        return prisma.onboardingMethod.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                isActive: data.isActive,
                autoActivatePhases: data.autoActivatePhases,
                expiresInDays: data.expiresInDays,
            },
            include: methodDetailInclude,
        });
    }

    /**
     * Delete an onboarding method. Fails if it has active onboarding instances.
     */
    async delete(tenantId: string, id: string) {
        const method = await prisma.onboardingMethod.findFirst({
            where: { id, tenantId },
            include: { _count: { select: { onboardings: true } } },
        });
        if (!method) throw new NotFoundError('Onboarding method not found');

        if (method._count.onboardings > 0) {
            throw new ValidationError(
                `Cannot delete: ${method._count.onboardings} onboarding instance(s) use this method. Deactivate it instead.`
            );
        }

        // Unlink from any org types first
        await prisma.organizationType.updateMany({
            where: { onboardingMethodId: id },
            data: { onboardingMethodId: null },
        });

        await prisma.onboardingMethod.delete({ where: { id } });
        return { deleted: true };
    }

    // =========================================================================
    // PHASES
    // =========================================================================

    /**
     * Add a phase to an onboarding method.
     */
    async addPhase(tenantId: string, methodId: string, data: AddMethodPhaseInput) {
        const method = await prisma.onboardingMethod.findFirst({
            where: { id: methodId, tenantId },
        });
        if (!method) throw new NotFoundError('Onboarding method not found');

        // Validate plan references based on phase category
        this.validatePhasePlanLinks(data.phaseCategory, data);

        return prisma.onboardingMethodPhase.create({
            data: {
                tenantId,
                onboardingMethodId: methodId,
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
     * Update a phase of an onboarding method.
     */
    async updatePhase(tenantId: string, methodId: string, phaseId: string, data: UpdateMethodPhaseInput) {
        const phase = await prisma.onboardingMethodPhase.findFirst({
            where: { id: phaseId, onboardingMethodId: methodId, tenantId },
        });
        if (!phase) throw new NotFoundError('Onboarding method phase not found');

        return prisma.onboardingMethodPhase.update({
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
     * Remove a phase from an onboarding method.
     */
    async removePhase(tenantId: string, methodId: string, phaseId: string) {
        const phase = await prisma.onboardingMethodPhase.findFirst({
            where: { id: phaseId, onboardingMethodId: methodId, tenantId },
        });
        if (!phase) throw new NotFoundError('Onboarding method phase not found');

        await prisma.onboardingMethodPhase.delete({ where: { id: phaseId } });
        return { deleted: true };
    }

    // =========================================================================
    // ORG TYPE LINKING
    // =========================================================================

    /**
     * Link this onboarding method to an organization type.
     * An org type can only be linked to one onboarding method at a time.
     */
    async linkToOrgType(tenantId: string, methodId: string, orgTypeId: string) {
        const method = await prisma.onboardingMethod.findFirst({
            where: { id: methodId, tenantId },
        });
        if (!method) throw new NotFoundError('Onboarding method not found');

        const orgType = await prisma.organizationType.findFirst({
            where: { id: orgTypeId, tenantId },
        });
        if (!orgType) throw new NotFoundError('Organization type not found');

        if (orgType.onboardingMethodId && orgType.onboardingMethodId !== methodId) {
            throw new ConflictError(
                `Organization type "${orgType.code}" is already linked to another onboarding method. Unlink it first.`
            );
        }

        await prisma.organizationType.update({
            where: { id: orgTypeId },
            data: { onboardingMethodId: methodId },
        });

        return this.findById(tenantId, methodId);
    }

    /**
     * Unlink an organization type from this onboarding method.
     */
    async unlinkOrgType(tenantId: string, methodId: string, orgTypeId: string) {
        const orgType = await prisma.organizationType.findFirst({
            where: { id: orgTypeId, tenantId, onboardingMethodId: methodId },
        });
        if (!orgType) throw new NotFoundError('Organization type not linked to this method');

        await prisma.organizationType.update({
            where: { id: orgTypeId },
            data: { onboardingMethodId: null },
        });

        return this.findById(tenantId, methodId);
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
            select: { id: true, code: true, name: true, onboardingMethodId: true },
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

export const onboardingMethodService = new OnboardingMethodService();
