import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { CreateTenantDto, UpdateTenantDto } from './tenant.dto';
import { TenantStatus } from './tenant.enums';

@Injectable()
export class TenantService {
    constructor(
        @InjectRepository(Tenant)
        private tenantRepo: Repository<Tenant>,
    ) { }

    async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
        // Check if subdomain already exists
        const existingSubdomain = await this.tenantRepo.findOne({
            where: { subdomain: createTenantDto.subdomain }
        });

        if (existingSubdomain) {
            throw new ConflictException('Subdomain already exists');
        }

        // Check if custom domain already exists
        if (createTenantDto.domain) {
            const existingDomain = await this.tenantRepo.findOne({
                where: { domain: createTenantDto.domain }
            });

            if (existingDomain) {
                throw new ConflictException('Domain already exists');
            }
        }

        const tenant = this.tenantRepo.create(createTenantDto);
        return this.tenantRepo.save(tenant);
    }

    async findAll(): Promise<Tenant[]> {
        return this.tenantRepo.find({
            order: { createdAt: 'DESC' }
        });
    }

    async findOne(id: number): Promise<Tenant> {
        const tenant = await this.tenantRepo.findOne({ where: { id } });

        if (!tenant) {
            throw new NotFoundException(`Tenant with ID ${id} not found`);
        }

        return tenant;
    }

    async findBySubdomain(subdomain: string): Promise<Tenant | null> {
        return this.tenantRepo.findOne({ where: { subdomain } });
    }

    async findByDomain(domain: string): Promise<Tenant | null> {
        return this.tenantRepo.findOne({ where: { domain } });
    }

    async update(id: number, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
        const tenant = await this.findOne(id);

        // Check if updating domain and it already exists
        if (updateTenantDto.domain && updateTenantDto.domain !== tenant.domain) {
            const existingDomain = await this.tenantRepo.findOne({
                where: { domain: updateTenantDto.domain }
            });

            if (existingDomain && existingDomain.id !== id) {
                throw new ConflictException('Domain already exists');
            }
        }

        Object.assign(tenant, updateTenantDto);
        return this.tenantRepo.save(tenant);
    }

    async remove(id: number): Promise<void> {
        const tenant = await this.findOne(id);
        await this.tenantRepo.softDelete(id);
    }

    async suspend(id: number): Promise<Tenant> {
        return this.update(id, { status: TenantStatus.SUSPENDED });
    }

    async activate(id: number): Promise<Tenant> {
        return this.update(id, { status: TenantStatus.ACTIVE });
    }

    async isActive(tenantId: number): Promise<boolean> {
        const tenant = await this.findOne(tenantId);
        return tenant.status === TenantStatus.ACTIVE;
    }
}

export default TenantService;
