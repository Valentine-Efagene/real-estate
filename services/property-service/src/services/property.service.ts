import { prisma } from '../lib/prisma.js';
import { AppError } from '@valentine-efagene/qshelter-common';
import type { CreatePropertyInput, UpdatePropertyInput } from '../validators/property.validator.js';

class PropertyService {
    async createProperty(data: CreatePropertyInput, userId: string) {
        const property = await prisma.property.create({
            data: {
                ...data,
                userId,
            },
        });
        return property;
    }

    async getProperties(filters?: { ownerId?: string; propertyType?: string }) {
        const properties = await prisma.property.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
        });
        return properties;
    }

    async getPropertyById(id: string) {
        const property = await prisma.property.findUnique({
            where: { id },
            include: {
                media: true,
                documents: true,
                amenities: {
                    include: {
                        amenity: true,
                    },
                },
            },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        return property;
    }

    async updateProperty(id: string, data: UpdatePropertyInput, userId: string) {
        // Verify ownership
        const property = await prisma.property.findUnique({
            where: { id },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        if (property.userId !== userId) {
            throw new AppError(403, 'Unauthorized to update this property');
        }

        const updated = await prisma.property.update({
            where: { id },
            data,
        });

        return updated;
    }

    async deleteProperty(id: string, userId: string) {
        // Verify ownership
        const property = await prisma.property.findUnique({
            where: { id },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        if (property.userId !== userId) {
            throw new AppError(403, 'Unauthorized to delete this property');
        }

        await prisma.property.delete({
            where: { id },
        });

        return { success: true };
    }

    async getPropertyMedia(propertyId: string) {
        const media = await prisma.propertyMedia.findMany({
            where: { propertyId },
            orderBy: { createdAt: 'desc' },
        });
        return media;
    }

    async getPropertyDocuments(propertyId: string) {
        const documents = await prisma.propertyDocument.findMany({
            where: { propertyId },
            orderBy: { createdAt: 'desc' },
        });
        return documents;
    }

    async getAmenities() {
        const amenities = await prisma.amenity.findMany({
            orderBy: { name: 'asc' },
        });
        return amenities;
    }
}

export const propertyService = new PropertyService();
