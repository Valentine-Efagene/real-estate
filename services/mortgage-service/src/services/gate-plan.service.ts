import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import type { CreateGatePlanInput, UpdateGatePlanInput } from '../validators/gate-plan.validator';

type AnyPrismaClient = PrismaClient;

export interface GatePlanService {
    create(tenantId: string, data: CreateGatePlanInput): Promise<any>;
    findAll(filters?: { isActive?: boolean }): Promise<any[]>;
    findById(id: string): Promise<any>;
    update(id: string, data: UpdateGatePlanInput): Promise<any>;
    delete(id: string): Promise<{ success: boolean }>;
}

export function createGatePlanService(prisma: AnyPrismaClient = defaultPrisma): GatePlanService {

    async function resolveOrganizationTypeId(code: string, tenantId: string): Promise<string> {
        const orgType = await prisma.organizationType.findFirst({
            where: { code, tenantId },
        });
        if (!orgType) throw new AppError(404, `Organization type '${code}' not found`);
        return orgType.id;
    }

    async function create(tenantId: string, data: CreateGatePlanInput) {
        const { reviewerOrganizationTypeCode, ...rest } = data;
        const reviewerOrganizationTypeId = await resolveOrganizationTypeId(reviewerOrganizationTypeCode, tenantId);

        return prisma.gatePlan.create({
            data: {
                tenantId,
                ...rest,
                reviewerOrganizationTypeId,
            },
            include: { reviewerOrganizationType: true },
        });
    }

    async function findAll(filters?: { isActive?: boolean }) {
        const where: any = {};
        if (filters?.isActive !== undefined) where.isActive = filters.isActive;
        return prisma.gatePlan.findMany({
            where,
            include: { reviewerOrganizationType: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async function findById(id: string) {
        const plan = await prisma.gatePlan.findUnique({
            where: { id },
            include: { reviewerOrganizationType: true },
        });
        if (!plan) throw new AppError(404, 'Gate plan not found');
        return plan;
    }

    async function update(id: string, data: UpdateGatePlanInput) {
        const existing = await findById(id);
        const updateData: any = { ...data };

        if (data.reviewerOrganizationTypeCode) {
            if (!existing.tenantId) throw new AppError(400, 'Gate plan has no tenant context');
            updateData.reviewerOrganizationTypeId = await resolveOrganizationTypeId(
                data.reviewerOrganizationTypeCode,
                existing.tenantId,
            );
            delete updateData.reviewerOrganizationTypeCode;
        }

        return prisma.gatePlan.update({
            where: { id },
            data: updateData,
            include: { reviewerOrganizationType: true },
        });
    }

    async function deleteGatePlan(id: string) {
        await findById(id);
        await prisma.gatePlan.delete({ where: { id } });
        return { success: true };
    }

    return { create, findAll, findById, update, delete: deleteGatePlan };
}

export const gatePlanService: GatePlanService = createGatePlanService();
