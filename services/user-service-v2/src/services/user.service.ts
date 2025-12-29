import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ConflictError } from '@valentine-efagene/qshelter-common';
import {
    createUserSchema,
    updateUserSchema,
    CreateUserInput,
    UpdateUserInput
} from '../validators/user.validator.js';

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    firstName?: string;
    lastName?: string;
    email?: string;
}

class UserService {
    async create(data: CreateUserInput) {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            throw new ConflictError('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);

        return prisma.user.create({
            data: {
                ...data,
                password: hashedPassword,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                isActive: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    async findById(id: string) {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                isActive: true,
                isEmailVerified: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
                userRoles: {
                    include: {
                        role: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        return user;
    }

    async findByEmail(email: string) {
        return prisma.user.findUnique({
            where: { email },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    async findAll(params: PaginationParams) {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            firstName,
            lastName,
            email,
        } = params;

        const where: any = {};

        if (firstName) {
            where.firstName = { contains: firstName, mode: 'insensitive' };
        }
        if (lastName) {
            where.lastName = { contains: lastName, mode: 'insensitive' };
        }
        if (email) {
            where.email = { contains: email, mode: 'insensitive' };
        }

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    isActive: true,
                    isEmailVerified: true,
                    lastLoginAt: true,
                    createdAt: true,
                    updatedAt: true,
                    userRoles: {
                        include: {
                            role: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async update(id: string, data: UpdateUserInput) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        return prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
                isActive: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    async suspend(id: string, reason?: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        await prisma.userSuspension.create({
            data: {
                userId: id,
                reason: reason || 'No reason provided',
                suspendedAt: new Date(),
            },
        });

        return prisma.user.update({
            where: { id },
            data: { isActive: false },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
            },
        });
    }

    async reinstate(id: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Mark the last suspension as lifted
        const lastSuspension = await prisma.userSuspension.findFirst({
            where: { userId: id, liftedAt: null },
            orderBy: { suspendedAt: 'desc' },
        });

        if (lastSuspension) {
            await prisma.userSuspension.update({
                where: { id: lastSuspension.id },
                data: { liftedAt: new Date() },
            });
        }

        return prisma.user.update({
            where: { id },
            data: { isActive: true },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
            },
        });
    }

    async delete(id: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        await prisma.user.delete({ where: { id } });
    }

    async assignRoles(userId: string, roleIds: string[]) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Delete existing user roles
        await prisma.userRole.deleteMany({
            where: { userId },
        });

        // Create new user role associations
        await prisma.userRole.createMany({
            data: roleIds.map((roleId) => ({
                userId,
                roleId,
            })),
        });

        return this.findById(userId);
    }
}

export const userService = new UserService();
