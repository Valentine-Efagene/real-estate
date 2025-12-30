import { prisma } from '../lib/prisma';
import { AppError } from '@valentine-efagene/qshelter-common';
import type { CreateAmenityInput, UpdateAmenityInput } from '../validators/amenity.validator';

class AmenityService {
    async createAmenity(data: CreateAmenityInput) {
        const amenity = await prisma.amenity.create({
            data,
        });
        return amenity;
    }

    async getAmenities() {
        const amenities = await prisma.amenity.findMany({
            orderBy: { name: 'asc' },
        });
        return amenities;
    }

    async getAmenityById(id: string) {
        const amenity = await prisma.amenity.findUnique({
            where: { id },
        });

        if (!amenity) {
            throw new AppError(404, 'Amenity not found');
        }

        return amenity;
    }

    async updateAmenity(id: string, data: UpdateAmenityInput) {
        const amenity = await prisma.amenity.findUnique({
            where: { id },
        });

        if (!amenity) {
            throw new AppError(404, 'Amenity not found');
        }

        const updated = await prisma.amenity.update({
            where: { id },
            data,
        });

        return updated;
    }

    async deleteAmenity(id: string) {
        const amenity = await prisma.amenity.findUnique({
            where: { id },
        });

        if (!amenity) {
            throw new AppError(404, 'Amenity not found');
        }

        await prisma.amenity.delete({
            where: { id },
        });

        return { success: true };
    }
}

export const amenityService = new AmenityService();
