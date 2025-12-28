import { prisma } from '../lib/prisma.js';
import { NotFoundError, ConflictError } from '@valentine-efagene/qshelter-common';

export interface CreateTenantInput {
    name: string;
    subdomain?: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
}

export interface UpdateTenantInput {
    name?: string;
    subdomain?: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    isActive?: boolean;
}

class TenantService {
    async create(data: CreateTenantInput) {
        if (data.subdomain) {
            const existing = await prisma.tenant.findUnique({ where: { subdomain: data.subdomain } });
            if (existing) {
                throw new ConflictError('Subdomain already exists');
            }
        }

        return prisma.tenant.create({
            data: {
                name: data.name,
                subdomain: data.subdomain,
                logo: data.logo,
                primaryColor: data.primaryColor,
                secondaryColor: data.secondaryColor,
            },
        });
    }

    async findAll() {
        return prisma.tenant.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async findById(id: string) {
        const tenant = await prisma.tenant.findUnique({
            where: { id },
        });

        if (!tenant) {
            throw new NotFoundError('Tenant not found');
        }

        return tenant;
    }

    async findBySubdomain(subdomain: string) {
        const tenant = await prisma.tenant.findUnique({
            where: { subdomain },
        });

        if (!tenant) {
            throw new NotFoundError('Tenant not found');
        }

        return tenant;
    }

    async update(id: string, data: UpdateTenantInput) {
        const tenant = await prisma.tenant.findUnique({ where: { id } });
        if (!tenant) {
            throw new NotFoundError('Tenant not found');
        }

        if (data.subdomain && data.subdomain !== tenant.subdomain) {
            const existing = await prisma.tenant.findUnique({ where: { subdomain: data.subdomain } });
            if (existing) {
                throw new ConflictError('Subdomain already exists');
            }
        }

        return prisma.tenant.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        const tenant = await prisma.tenant.findUnique({ where: { id } });
        if (!tenant) {
            throw new NotFoundError('Tenant not found');
        }

        await prisma.tenant.delete({ where: { id } });
    }
}

export const tenantService = new TenantService();
