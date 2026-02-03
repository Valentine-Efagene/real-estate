import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type { CreatePropertyInput, UpdatePropertyInput } from '../validators/property.validator';

class PropertyService {
    async createProperty(data: CreatePropertyInput, userId: string, tenantId: string) {
        // If organizationId is provided, verify user is a member of that organization
        if (data.organizationId) {
            const membership = await prisma.organizationMember.findFirst({
                where: {
                    userId,
                    organizationId: data.organizationId,
                },
            });
            if (!membership) {
                throw new AppError(403, 'You must be a member of the organization to create a property for it');
            }

            // Verify the organization belongs to the tenant
            const org = await prisma.organization.findFirst({
                where: {
                    id: data.organizationId,
                    tenantId,
                },
            });
            if (!org) {
                throw new AppError(404, 'Organization not found');
            }
        }

        const property = await prisma.property.create({
            data: {
                ...data,
                userId,
                tenantId,
            },
        });
        return property;
    }

    async getProperties(filters?: { ownerId?: string; propertyType?: string }) {
        const properties = await prisma.property.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
        });
        return { items: properties, total: properties.length };
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
                organization: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        return property;
    }

    /**
     * Check if a user can manage a property
     * Returns true if:
     * - User is the direct owner (userId matches)
     * - Property belongs to an organization and user is a member
     */
    async canManageProperty(propertyId: string, userId: string): Promise<boolean> {
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
        });

        if (!property) {
            return false;
        }

        // Direct owner
        if (property.userId === userId) {
            return true;
        }

        // Organization member (if property belongs to an org)
        if (property.organizationId) {
            const membership = await prisma.organizationMember.findFirst({
                where: {
                    userId,
                    organizationId: property.organizationId,
                },
            });
            return !!membership;
        }

        return false;
    }

    async updateProperty(id: string, data: UpdatePropertyInput, userId: string) {
        const canManage = await this.canManageProperty(id, userId);
        if (!canManage) {
            throw new AppError(403, 'Unauthorized to update this property');
        }

        const updated = await prisma.property.update({
            where: { id },
            data,
        });

        return updated;
    }

    async deleteProperty(id: string, userId: string) {
        const canManage = await this.canManageProperty(id, userId);
        if (!canManage) {
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

    async publishProperty(id: string, tenantId: string) {
        const property = await prisma.property.findFirst({
            where: { id, tenantId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        if (property.status === 'PUBLISHED') {
            return property; // Idempotent - already published
        }

        const updated = await prisma.property.update({
            where: { id },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(),
            },
        });

        return updated;
    }

    async unpublishProperty(id: string, tenantId: string) {
        const property = await prisma.property.findFirst({
            where: { id, tenantId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        if (property.status !== 'PUBLISHED') {
            return property; // Idempotent - already unpublished
        }

        const updated = await prisma.property.update({
            where: { id },
            data: {
                status: 'DRAFT',
            },
        });

        return updated;
    }

    async addPropertyMedia(
        propertyId: string,
        tenantId: string,
        media: Array<{ url: string; type: string; order?: number; caption?: string }>
    ) {
        // Verify property exists and belongs to tenant
        const property = await prisma.property.findFirst({
            where: { id: propertyId, tenantId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        // Create all media entries
        const created = await prisma.$transaction(
            media.map((item, index) =>
                prisma.propertyMedia.create({
                    data: {
                        propertyId,
                        tenantId,
                        url: item.url,
                        type: item.type,
                        order: item.order ?? index,
                        caption: item.caption,
                    },
                })
            )
        );

        return created;
    }

    async deletePropertyMedia(mediaId: string, tenantId: string) {
        const media = await prisma.propertyMedia.findFirst({
            where: { id: mediaId, tenantId },
        });

        if (!media) {
            throw new AppError(404, 'Media not found');
        }

        await prisma.propertyMedia.delete({
            where: { id: mediaId },
        });

        return { success: true };
    }
}

export const propertyService = new PropertyService();
