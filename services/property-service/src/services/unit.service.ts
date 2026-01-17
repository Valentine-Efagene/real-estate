import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type { CreateUnitInput, UpdateUnitInput } from '../validators/unit.validator';

class UnitService {
    async createUnit(variantId: string, data: CreateUnitInput, tenantId: string) {
        // Verify variant exists and belongs to tenant's property
        const variant = await prisma.propertyVariant.findUnique({
            where: { id: variantId },
            include: { property: { select: { tenantId: true } } },
        });

        if (!variant) {
            throw new AppError(404, 'Variant not found');
        }

        if (variant.property.tenantId !== tenantId) {
            throw new AppError(403, 'Access denied');
        }

        // Check for duplicate unit number
        const existing = await prisma.propertyUnit.findFirst({
            where: { variantId, unitNumber: data.unitNumber },
        });

        if (existing) {
            throw new AppError(409, `Unit ${data.unitNumber} already exists in this variant`);
        }

        const unit = await prisma.$transaction(async (tx) => {
            // Create the unit
            const newUnit = await tx.propertyUnit.create({
                data: {
                    variantId,
                    tenantId,
                    unitNumber: data.unitNumber,
                    floorNumber: data.floorNumber,
                    blockName: data.blockName,
                    priceOverride: data.priceOverride,
                    areaOverride: data.areaOverride,
                    notes: data.notes,
                    status: data.status ?? 'AVAILABLE',
                },
            });

            // Update variant's unit counts
            await tx.propertyVariant.update({
                where: { id: variantId },
                data: {
                    totalUnits: { increment: 1 },
                    availableUnits: data.status === 'AVAILABLE' ? { increment: 1 } : undefined,
                },
            });

            return newUnit;
        });

        return unit;
    }

    async getUnits(variantId: string, tenantId: string, filters?: { status?: string }) {
        // Verify variant exists and belongs to tenant's property
        const variant = await prisma.propertyVariant.findUnique({
            where: { id: variantId },
            include: { property: { select: { tenantId: true } } },
        });

        if (!variant) {
            throw new AppError(404, 'Variant not found');
        }

        if (variant.property.tenantId !== tenantId) {
            throw new AppError(403, 'Access denied');
        }

        const units = await prisma.propertyUnit.findMany({
            where: {
                variantId,
                ...(filters?.status ? { status: filters.status } : {}),
            },
            include: {
                variant: {
                    select: {
                        name: true,
                        price: true,
                        property: {
                            select: { title: true },
                        },
                    },
                },
            },
            orderBy: [{ blockName: 'asc' }, { floorNumber: 'asc' }, { unitNumber: 'asc' }],
        });

        return units;
    }

    async getUnitById(unitId: string, tenantId: string) {
        const unit = await prisma.propertyUnit.findUnique({
            where: { id: unitId },
            include: {
                variant: {
                    include: {
                        property: { select: { tenantId: true, title: true } },
                    },
                },
            },
        });

        if (!unit) {
            throw new AppError(404, 'Unit not found');
        }

        if (unit.variant.property.tenantId !== tenantId) {
            throw new AppError(403, 'Access denied');
        }

        return unit;
    }

    async updateUnit(unitId: string, data: UpdateUnitInput, tenantId: string) {
        // Verify unit exists and tenant has access
        const existing = await this.getUnitById(unitId, tenantId);
        const oldStatus = existing.status;

        // Check for duplicate unit number if changing
        if (data.unitNumber && data.unitNumber !== existing.unitNumber) {
            const duplicate = await prisma.propertyUnit.findFirst({
                where: {
                    variantId: existing.variantId,
                    unitNumber: data.unitNumber,
                    id: { not: unitId },
                },
            });

            if (duplicate) {
                throw new AppError(409, `Unit ${data.unitNumber} already exists in this variant`);
            }
        }

        const unit = await prisma.$transaction(async (tx) => {
            const updated = await tx.propertyUnit.update({
                where: { id: unitId },
                data: {
                    unitNumber: data.unitNumber,
                    floorNumber: data.floorNumber,
                    blockName: data.blockName,
                    priceOverride: data.priceOverride,
                    areaOverride: data.areaOverride,
                    notes: data.notes,
                    status: data.status,
                },
            });

            // Update variant counts if status changed
            if (data.status && data.status !== oldStatus) {
                const countUpdates: any = {};

                if (oldStatus === 'AVAILABLE') {
                    countUpdates.availableUnits = { decrement: 1 };
                } else if (oldStatus === 'RESERVED') {
                    countUpdates.reservedUnits = { decrement: 1 };
                } else if (oldStatus === 'SOLD') {
                    countUpdates.soldUnits = { decrement: 1 };
                }

                if (data.status === 'AVAILABLE') {
                    countUpdates.availableUnits = { ...(countUpdates.availableUnits || {}), increment: 1 };
                } else if (data.status === 'RESERVED') {
                    countUpdates.reservedUnits = { ...(countUpdates.reservedUnits || {}), increment: 1 };
                } else if (data.status === 'SOLD') {
                    countUpdates.soldUnits = { ...(countUpdates.soldUnits || {}), increment: 1 };
                }

                if (Object.keys(countUpdates).length > 0) {
                    await tx.propertyVariant.update({
                        where: { id: existing.variantId },
                        data: countUpdates,
                    });
                }
            }

            return updated;
        });

        return unit;
    }

    async deleteUnit(unitId: string, tenantId: string) {
        // Verify unit exists and tenant has access
        const unit = await this.getUnitById(unitId, tenantId);

        // Check if unit has active applications using raw query
        const hasActiveApplications = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM applications
            WHERE property_unit_id = ${unitId}
            AND status IN ('DRAFT', 'PENDING', 'ACTIVE')
        `;

        if (hasActiveApplications[0]?.count > 0) {
            throw new AppError(400, 'Cannot delete unit with active applications');
        }

        await prisma.$transaction(async (tx) => {
            // Delete the unit
            await tx.propertyUnit.delete({
                where: { id: unitId },
            });

            // Update variant counts
            const countUpdates: any = { totalUnits: { decrement: 1 } };

            if (unit.status === 'AVAILABLE') {
                countUpdates.availableUnits = { decrement: 1 };
            } else if (unit.status === 'RESERVED') {
                countUpdates.reservedUnits = { decrement: 1 };
            } else if (unit.status === 'SOLD') {
                countUpdates.soldUnits = { decrement: 1 };
            }

            await tx.propertyVariant.update({
                where: { id: unit.variantId },
                data: countUpdates,
            });
        });

        return { success: true };
    }
}

export const unitService = new UnitService();
