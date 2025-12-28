import { prisma } from '../lib/prisma.js';
import { NotFoundError, ConflictError } from '@valentine-efagene/qshelter-common';

export interface CreateRoleInput {
    name: string;
    description?: string;
}

export interface UpdateRoleInput {
    name?: string;
    description?: string;
}

class RoleService {
    async create(data: CreateRoleInput) {
        const existing = await prisma.role.findUnique({ where: { name: data.name } });
        if (existing) {
            throw new ConflictError('Role name already exists');
        }

        return prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
            },
        });
    }

    async findAll() {
        return prisma.role.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async findById(id: string) {
        const role = await prisma.role.findUnique({
            where: { id },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        return role;
    }

    async update(id: string, data: UpdateRoleInput) {
        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) {
            throw new NotFoundError('Role not found');
        }

        if (data.name && data.name !== role.name) {
            const existing = await prisma.role.findUnique({ where: { name: data.name } });
            if (existing) {
                throw new ConflictError('Role name already exists');
            }
        }

        return prisma.role.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) {
            throw new NotFoundError('Role not found');
        }

        await prisma.role.delete({ where: { id } });
    }
}

export const roleService = new RoleService();
