import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type { CreatePropertyInput, UpdatePropertyInput } from '../validators/property.validator';
import type { CreatePropertyPromotionInput, UpdatePropertyPromotionInput } from '../validators/property-promotion.validator';

class PropertyService {
    private isPromotionActive(promotion: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now: Date): boolean {
        if (!promotion.isActive) return false;
        if (promotion.startsAt && promotion.startsAt > now) return false;
        if (promotion.endsAt && promotion.endsAt < now) return false;
        return true;
    }

    private calculateDiscount(
        basePrice: number,
        promotion: { discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'; discountValue: number; maxDiscount: number | null }
    ): number {
        let discount = promotion.discountType === 'PERCENTAGE'
            ? (basePrice * promotion.discountValue) / 100
            : promotion.discountValue;

        if (promotion.maxDiscount != null) {
            discount = Math.min(discount, promotion.maxDiscount);
        }

        return Math.max(0, Math.min(basePrice, discount));
    }

    private enrichVariantsWithPromotions(
        variants: Array<any>,
        propertyPromotions: Array<any>
    ) {
        const now = new Date();

        return variants.map((variant) => {
            const applicablePromotions = [
                ...propertyPromotions,
                ...(variant.promotions || []),
            ]
                .filter((p) => this.isPromotionActive(p, now))
                .map((p) => ({
                    ...p,
                    discountAmount: this.calculateDiscount(variant.price, p),
                }))
                .filter((p) => p.discountAmount > 0)
                .sort((a, b) => {
                    if (a.priority !== b.priority) return a.priority - b.priority;
                    return b.discountAmount - a.discountAmount;
                });

            const bestPromotion = applicablePromotions[0] || null;
            const discountAmount = bestPromotion?.discountAmount ?? 0;
            const displayPrice = Math.max(0, variant.price - discountAmount);
            const discountPercentage = variant.price > 0 ? Math.round((discountAmount / variant.price) * 10000) / 100 : 0;

            const { promotions, ...variantBase } = variant;

            return {
                ...variantBase,
                originalPrice: variant.price,
                discountAmount,
                discountPercentage,
                displayPrice,
                activePromotion: bestPromotion
                    ? {
                        id: bestPromotion.id,
                        name: bestPromotion.name,
                        discountType: bestPromotion.discountType,
                        discountValue: bestPromotion.discountValue,
                    }
                    : null,
            };
        });
    }

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

    async getProperties(params?: {
        tenantId?: string;
        keyword?: string;
        category?: string;
        propertyType?: string;
        city?: string;
        country?: string;
        status?: string;
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
        return this.searchProperties(params || {});
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
        if (sortBy === 'oldest') {
            orderBy = { createdAt: 'asc' };
        }
        if (sortBy === 'price_asc') {
            orderBy = { variants: { _min: { price: 'asc' } } };
        }
        if (sortBy === 'price_desc') {
            orderBy = { variants: { _max: { price: 'desc' } } };
        }

        const [items, total] = await Promise.all([
            prisma.property.findMany({
                where: where as any,
                orderBy: orderBy as any,
                skip,
                take: limit,
                include: {
                    displayImage: { select: { id: true, url: true } },
                    promotions: {
                        where: { variantId: null },
                        select: {
                            id: true,
                            name: true,
                            discountType: true,
                            discountValue: true,
                            maxDiscount: true,
                            startsAt: true,
                            endsAt: true,
                            isActive: true,
                            priority: true,
                        },
                    },
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
                            promotions: {
                                select: {
                                    id: true,
                                    name: true,
                                    discountType: true,
                                    discountValue: true,
                                    maxDiscount: true,
                                    startsAt: true,
                                    endsAt: true,
                                    isActive: true,
                                    priority: true,
                                },
                            },
                        },
                    },
                    organization: { select: { id: true, name: true } },
                },
            }),
            prisma.property.count({
                where: where as any,
            }),
        ]);

        const transformedItems = items.map((item: any) => {
            const enrichedVariants = this.enrichVariantsWithPromotions(item.variants || [], item.promotions || []);
            const { promotions, ...propertyBase } = item;

            return {
                ...propertyBase,
                variants: enrichedVariants,
            };
        });

        return {
            items: transformedItems,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        };
    }

    async createPromotion(propertyId: string, data: CreatePropertyPromotionInput, tenantId: string, userId: string) {
        const canManage = await this.canManageProperty(propertyId, userId);
        if (!canManage) {
            throw new AppError(403, 'Unauthorized to manage promotions for this property');
        }

        const property = await prisma.property.findFirst({
            where: { id: propertyId, tenantId },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        if (data.variantId) {
            const variant = await prisma.propertyVariant.findFirst({
                where: { id: data.variantId, propertyId, tenantId },
            });
            if (!variant) {
                throw new AppError(400, 'variantId does not belong to this property');
            }
        }

        const startsAt = data.startsAt ? new Date(data.startsAt) : undefined;
        const endsAt = data.endsAt ? new Date(data.endsAt) : undefined;

        if (startsAt && endsAt && startsAt > endsAt) {
            throw new AppError(400, 'startsAt must be before endsAt');
        }

        return prisma.propertyPromotion.create({
            data: {
                tenantId,
                propertyId,
                variantId: data.variantId,
                name: data.name,
                description: data.description,
                discountType: data.discountType,
                discountValue: data.discountValue,
                maxDiscount: data.maxDiscount,
                startsAt,
                endsAt,
                isActive: data.isActive ?? true,
                priority: data.priority ?? 100,
            },
        });
    }

    async listPromotions(propertyId: string, tenantId: string) {
        const property = await prisma.property.findFirst({
            where: { id: propertyId, tenantId },
            select: { id: true },
        });

        if (!property) {
            throw new AppError(404, 'Property not found');
        }

        return prisma.propertyPromotion.findMany({
            where: { propertyId, tenantId },
            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        });
    }

    async updatePromotion(propertyId: string, promotionId: string, data: UpdatePropertyPromotionInput, tenantId: string, userId: string) {
        const canManage = await this.canManageProperty(propertyId, userId);
        if (!canManage) {
            throw new AppError(403, 'Unauthorized to manage promotions for this property');
        }

        const existing = await prisma.propertyPromotion.findFirst({
            where: { id: promotionId, propertyId, tenantId },
        });

        if (!existing) {
            throw new AppError(404, 'Promotion not found');
        }

        if (data.variantId) {
            const variant = await prisma.propertyVariant.findFirst({
                where: { id: data.variantId, propertyId, tenantId },
            });
            if (!variant) {
                throw new AppError(400, 'variantId does not belong to this property');
            }
        }

        const nextStartsAt = data.startsAt ? new Date(data.startsAt) : data.startsAt === undefined ? existing.startsAt : null;
        const nextEndsAt = data.endsAt ? new Date(data.endsAt) : data.endsAt === undefined ? existing.endsAt : null;

        if (nextStartsAt && nextEndsAt && nextStartsAt > nextEndsAt) {
            throw new AppError(400, 'startsAt must be before endsAt');
        }

        return prisma.propertyPromotion.update({
            where: { id: promotionId },
            data: {
                variantId: data.variantId,
                name: data.name,
                description: data.description,
                discountType: data.discountType,
                discountValue: data.discountValue,
                maxDiscount: data.maxDiscount,
                startsAt: nextStartsAt,
                endsAt: nextEndsAt,
                isActive: data.isActive,
                priority: data.priority,
            },
        });
    }

    async deletePromotion(propertyId: string, promotionId: string, tenantId: string, userId: string) {
        const canManage = await this.canManageProperty(propertyId, userId);
        if (!canManage) {
            throw new AppError(403, 'Unauthorized to manage promotions for this property');
        }

        const existing = await prisma.propertyPromotion.findFirst({
            where: { id: promotionId, propertyId, tenantId },
            select: { id: true },
        });

        if (!existing) {
            throw new AppError(404, 'Promotion not found');
        }

        await prisma.propertyPromotion.delete({
            where: { id: promotionId },
        });

        return { success: true };
    }

    async getPropertyById(id: string, tenantId?: string) {
        const property = await prisma.property.findFirst({
            where: {
                id,
                ...(tenantId ? { tenantId } : {}),
            },
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
