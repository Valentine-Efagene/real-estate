import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '@valentine-efagene/qshelter-common';

export interface CreateSocialInput {
    userId: string;
    provider: string; // google, facebook, twitter, etc
    socialId: string; // ID from the social provider
}

export interface UpdateSocialInput {
    provider?: string;
    socialId?: string;
}

class SocialService {
    async create(data: CreateSocialInput) {
        return prisma.social.create({
            data: {
                userId: data.userId,
                provider: data.provider,
                socialId: data.socialId,
            },
        });
    }

    async findAllByUser(userId: string) {
        return prisma.social.findMany({
            where: { userId },
            orderBy: { provider: 'asc' },
        });
    }

    async findById(id: string) {
        const social = await prisma.social.findUnique({
            where: { id },
        });

        if (!social) {
            throw new NotFoundError('Social profile not found');
        }

        return social;
    }

    async update(id: string, data: UpdateSocialInput) {
        const social = await prisma.social.findUnique({ where: { id } });
        if (!social) {
            throw new NotFoundError('Social profile not found');
        }

        return prisma.social.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        const social = await prisma.social.findUnique({ where: { id } });
        if (!social) {
            throw new NotFoundError('Social profile not found');
        }

        await prisma.social.delete({ where: { id } });
    }
}

export const socialService = new SocialService();
