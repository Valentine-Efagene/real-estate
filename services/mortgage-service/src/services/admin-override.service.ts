import { prisma as defaultPrisma } from '../lib/prisma';
import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import type { CreateAdminDocumentOverrideInput } from '../validators/admin-override.validator';

type AnyPrismaClient = PrismaClient;

export interface AdminOverrideService {
    createOverride(tenantId: string, userId: string, data: CreateAdminDocumentOverrideInput): Promise<any>;
    listOverrides(tenantId: string, applicationId: string): Promise<any[]>;
}

export function createAdminOverrideService(prisma: AnyPrismaClient = defaultPrisma): AdminOverrideService {

    async function createOverride(tenantId: string, userId: string, data: CreateAdminDocumentOverrideInput) {
        const application = await prisma.application.findUnique({ where: { id: data.applicationId } });
        if (!application || application.tenantId !== tenantId) {
            throw new AppError(404, 'Application not found');
        }

        if (data.phaseId) {
            const phase = await prisma.applicationPhase.findUnique({ where: { id: data.phaseId } });
            if (!phase || phase.applicationId !== data.applicationId) {
                throw new AppError(404, 'Phase not found for this application');
            }
        }

        if (data.documentDefinitionId) {
            const docDef = await prisma.documentDefinition.findUnique({ where: { id: data.documentDefinitionId } });
            if (!docDef) {
                throw new AppError(404, 'Document definition not found');
            }
        }

        return prisma.adminDocumentOverride.create({
            data: {
                tenantId,
                applicationId: data.applicationId,
                phaseId: data.phaseId ?? null,
                documentDefinitionId: data.documentDefinitionId ?? null,
                decision: data.decision ?? 'proceed',
                reason: data.reason.trim(),
                createdById: userId,
            },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                phase: { select: { id: true, name: true, phaseCategory: true } },
                documentDefinition: { select: { id: true, documentType: true, documentName: true } },
            },
        });
    }

    async function listOverrides(tenantId: string, applicationId: string) {
        return prisma.adminDocumentOverride.findMany({
            where: { tenantId, applicationId },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                phase: { select: { id: true, name: true, phaseCategory: true } },
                documentDefinition: { select: { id: true, documentType: true, documentName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    return { createOverride, listOverrides };
}

export const adminOverrideService: AdminOverrideService = createAdminOverrideService();
