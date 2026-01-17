import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type { CreateVariantInput, UpdateVariantInput } from '../validators/variant.validator';

class VariantService {
    async createVariant(propertyId: string, data: CreateVariantInput, tenantId: string) {
        // Verify property exists and belongs to tenant
        const property = await prisma.property.findFirst({
            where: { id: propertyId, tenantId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        const variant = await prisma.propertyVariant.create({
            data: {
                propertyId,
                tenantId,
                name: data.name,
                description: data.description,
                nBedrooms: data.nBedrooms,
                nBathrooms: data.nBathrooms,
                nParkingSpots: data.nParkingSpots,
                area: data.area,
                price: data.price,
                pricePerSqm: data.pricePerSqm,
                totalUnits: data.totalUnits ?? 1,
                availableUnits: data.availableUnits ?? data.totalUnits ?? 1,
                status: data.status ?? 'AVAILABLE',
                isActive: data.isActive ?? true,
            },
        });

        return variant;
    }

    async getVariants(propertyId: string, tenantId: string) {
        // Verify property exists and belongs to tenant
        const property = await prisma.property.findFirst({
            where: { id: propertyId, tenantId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        const variants = await prisma.propertyVariant.findMany({
            where: { propertyId },
            include: {
                units: {
                    select: {
                        id: true,
                        unitNumber: true,
                        status: true,
                    },
                },
                _count: {
                    select: { units: true },
                },
            },
            orderBy: { price: 'asc' },
        });

        return variants;
    }

    async getVariantById(variantId: string, tenantId: string) {
        const variant = await prisma.propertyVariant.findUnique({
            where: { id: variantId },
            include: {
                property: { select: { tenantId: true } },
                units: true,
                amenities: { include: { amenity: true } },
                media: true,
            },
        });

        if (!variant) {
            throw new AppError(404, 'Variant not found');
        }

        if (variant.property.tenantId !== tenantId) {
            throw new AppError(403, 'Access denied');
        }

        return variant;
    }

    async updateVariant(variantId: string, data: UpdateVariantInput, tenantId: string) {
        // Verify variant exists and tenant has access
        const existing = await this.getVariantById(variantId, tenantId);

        const variant = await prisma.propertyVariant.update({
            where: { id: variantId },
            data: {
                name: data.name,
                description: data.description,
                nBedrooms: data.nBedrooms,
                nBathrooms: data.nBathrooms,
                nParkingSpots: data.nParkingSpots,
                area: data.area,
                price: data.price,
                pricePerSqm: data.pricePerSqm,
                totalUnits: data.totalUnits,
                availableUnits: data.availableUnits,
                status: data.status,
                isActive: data.isActive,
            },
        });

        return variant;
    }

    async deleteVariant(variantId: string, tenantId: string) {
        // Verify variant exists and tenant has access
        await this.getVariantById(variantId, tenantId);

        // Check if variant has any units with active applications
        // Using a join query since Application model may not be in this service's Prisma scope
        const unitsWithApplications = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM applications a
            INNER JOIN property_units pu ON a.property_unit_id = pu.id
            WHERE pu.variant_id = ${variantId}
            AND a.status IN ('DRAFT', 'PENDING', 'ACTIVE')
        `;

        if (unitsWithApplications[0]?.count > 0) {
            throw new AppError(400, 'Cannot delete variant with active applications');
        }

        await prisma.propertyVariant.delete({
            where: { id: variantId },
        });

        return { success: true };
    }
}

export const variantService = new VariantService();
