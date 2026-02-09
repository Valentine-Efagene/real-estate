import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type { CreatePropertyInput, UpdatePropertyInput } from '../validators/property.validator';

class PropertyService {
    async createProperty(data: CreatePropertyInput, userId: string, tenantId: string) {
        let organizationId = data.organizationId;

        // Look up the DEVELOPER organization type for this tenant
        const developerType = await prisma.organizationType.findFirst({
            where: { tenantId, code: 'DEVELOPER' },
        });

        if (organizationId) {
            // Explicit org provided — verify membership
            const membership = await prisma.organizationMember.findFirst({
                where: { userId, organizationId },
            });
            if (!membership) {
                throw new AppError(403, 'You must be a member of the organization to create a property for it');
            }

            // Verify org belongs to this tenant
            const org = await prisma.organization.findFirst({
                where: { id: organizationId, tenantId },
            });
            if (!org) {
                throw new AppError(404, 'Organization not found');
            }

            // Verify the org has DEVELOPER type
            if (developerType) {
                const hasDevType = await prisma.organizationTypeAssignment.findFirst({
                    where: { organizationId, typeId: developerType.id },
                });
                if (!hasDevType) {
                    throw new AppError(400, 'Organization must have the DEVELOPER type to own properties');
                }
            }
        } else {
            // No org provided — auto-detect user's DEVELOPER org
            if (!developerType) {
                throw new AppError(500, 'DEVELOPER organization type not configured for this tenant');
            }

            // Find any org the user belongs to that has the DEVELOPER type
            // (an org can have multiple types, e.g. QShelter can be PLATFORM + DEVELOPER)
            const devMembership = await prisma.organizationMember.findFirst({
                where: {
                    userId,
                    organization: {
                        types: {
                            some: { typeId: developerType.id },
                        },
                    },
                },
            });

            if (devMembership) {
                organizationId = devMembership.organizationId;
            } else {
                throw new AppError(403, 'You must belong to a DEVELOPER organization to create a property');
            }
        }

        const property = await prisma.property.create({
            data: {
                ...data,
                organizationId,
                userId,
                tenantId,
                // If status is PUBLISHED, set publishedAt
                publishedAt: data.status === 'PUBLISHED' ? new Date() : undefined,
            },
        });
        return property;
    }

    async getProperties(filters?: { ownerId?: string; propertyType?: string }) {
        const properties = await prisma.property.findMany({
            where: filters,
            orderBy: { createdAt: 'desc' },
            include: {
                displayImage: {
                    select: {
                        id: true,
                        url: true,
                    },
                },
            },
        });
        return { items: properties, total: properties.length };
    }

    async getPropertyById(id: string) {
        const property = await prisma.property.findUnique({
            where: { id },
            include: {
                displayImage: {
                    select: {
                        id: true,
                        url: true,
                    },
                },
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
