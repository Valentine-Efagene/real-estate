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

    /**
     * Search/filter properties with pagination and sorting.
     */
    async searchProperties(params: {
        tenantId?: string;
        keyword?: string;
        category?: string;       // SALE, RENT, LEASE
        propertyType?: string;   // APARTMENT, HOUSE, LAND, COMMERCIAL, ESTATE, TOWNHOUSE
        city?: string;
        country?: string;
        status?: string;         // DRAFT, PUBLISHED, SOLD, UNAVAILABLE
        minPrice?: number;
        maxPrice?: number;
        minBedrooms?: number;
        maxBedrooms?: number;
        availableUnitsOnly?: boolean;
        organizationId?: string;
        sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
        page?: number;
        limit?: number;
    }) {
        const {
            tenantId,
            keyword,
            category,
            propertyType,
            city,
            country,
            status,
            minPrice,
            maxPrice,
            minBedrooms,
            maxBedrooms,
            availableUnitsOnly,
            organizationId,
            sortBy = 'newest',
            page = 1,
            limit = 20,
        } = params;

        const skip = (page - 1) * limit;

        // Build the where clause
        const where: Record<string, unknown> = {};
        if (tenantId) where['tenantId'] = tenantId;
        if (category) where['category'] = category;
        if (propertyType) where['propertyType'] = propertyType;
        if (city) where['city'] = { contains: city };
        if (country) where['country'] = country;
        if (status) where['status'] = status;
        else where['status'] = 'PUBLISHED'; // Default: only show published
        if (organizationId) where['organizationId'] = organizationId;

        // Keyword search across title, description, city, district
        if (keyword) {
            where['OR'] = [
                { title: { contains: keyword } },
                { description: { contains: keyword } },
                { city: { contains: keyword } },
                { district: { contains: keyword } },
                { streetAddress: { contains: keyword } },
            ];
        }

        // Price / bedroom filter via variants
        const variantFilter: Record<string, unknown> = {};

        const variantPriceFilter: Record<string, unknown> = {};
        if (minPrice !== undefined) variantPriceFilter['gte'] = minPrice;
        if (maxPrice !== undefined) variantPriceFilter['lte'] = maxPrice;
        if (Object.keys(variantPriceFilter).length > 0) {
            variantFilter['price'] = variantPriceFilter;
        }

        const variantBedroomsFilter: Record<string, unknown> = {};
        if (minBedrooms !== undefined) variantBedroomsFilter['gte'] = minBedrooms;
        if (maxBedrooms !== undefined) variantBedroomsFilter['lte'] = maxBedrooms;
        if (Object.keys(variantBedroomsFilter).length > 0) {
            variantFilter['nBedrooms'] = variantBedroomsFilter;
        }

        if (availableUnitsOnly) {
            variantFilter['availableUnits'] = { gt: 0 };
        }

        if (Object.keys(variantFilter).length > 0) {
            where['variants'] = { some: variantFilter };
        }

        // Sorting
        let orderBy: Record<string, unknown> = { createdAt: 'desc' };
        if (sortBy === 'oldest') orderBy = { createdAt: 'asc' };

        const [items, total] = await Promise.all([
            prisma.property.findMany({
                where: where as Parameters<typeof prisma.property.findMany>[0]['where'],
                orderBy: orderBy as Parameters<typeof prisma.property.findMany>[0]['orderBy'],
                skip,
                take: limit,
                include: {
                    displayImage: { select: { id: true, url: true } },
                    variants: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            nBedrooms: true,
                            nBathrooms: true,
                            availableUnits: true,
                            totalUnits: true,
                            status: true,
                        },
                    },
                    organization: { select: { id: true, name: true } },
                },
            }),
            prisma.property.count({
                where: where as Parameters<typeof prisma.property.count>[0]['where'],
            }),
        ]);

        return {
            items,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        };
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
