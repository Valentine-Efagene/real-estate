import { Repository, FindManyOptions, FindOneOptions, FindOptionsWhere, DeepPartial } from 'typeorm';

/**
 * Base repository with automatic tenant scoping
 * All queries automatically filter by tenantId
 */
export class TenantAwareRepository<Entity extends { tenantId: number }> extends Repository<Entity> {
    /**
     * Find entities with automatic tenant filtering
     */
    async findByTenant(tenantId: number, options?: FindManyOptions<Entity>): Promise<Entity[]> {
        return this.find({
            ...options,
            where: {
                ...options?.where,
                tenantId,
            } as FindOptionsWhere<Entity>,
        });
    }

    /**
     * Find one entity with automatic tenant filtering
     */
    async findOneByTenant(
        tenantId: number,
        options?: FindOneOptions<Entity>
    ): Promise<Entity | null> {
        return this.findOne({
            ...options,
            where: {
                ...options?.where,
                tenantId,
            } as FindOptionsWhere<Entity>,
        });
    }

    /**
     * Count entities with automatic tenant filtering
     */
    async countByTenant(tenantId: number, options?: FindManyOptions<Entity>): Promise<number> {
        return this.count({
            ...options,
            where: {
                ...options?.where,
                tenantId,
            } as FindOptionsWhere<Entity>,
        });
    }

    /**
     * Create and save entity with automatic tenantId
     */
    async createForTenant(tenantId: number, entityData: DeepPartial<Entity>): Promise<Entity> {
        const entity = this.create({
            ...entityData,
            tenantId,
        } as DeepPartial<Entity>);
        return this.save(entity);
    }

    /**
     * Update entity with tenant validation
     */
    async updateForTenant(
        tenantId: number,
        id: number,
        entityData: DeepPartial<Entity>
    ): Promise<Entity> {
        const entity = await this.findOneByTenant(tenantId, { where: { id } as any });
        if (!entity) {
            throw new Error(`Entity with ID ${id} not found for tenant ${tenantId}`);
        }
        Object.assign(entity, entityData);
        return this.save(entity);
    }

    /**
     * Delete entity with tenant validation
     */
    async deleteForTenant(tenantId: number, id: number): Promise<void> {
        const entity = await this.findOneByTenant(tenantId, { where: { id } as any });
        if (!entity) {
            throw new Error(`Entity with ID ${id} not found for tenant ${tenantId}`);
        }
        await this.remove(entity);
    }

    /**
     * Soft delete entity with tenant validation
     */
    async softDeleteForTenant(tenantId: number, id: number): Promise<void> {
        const entity = await this.findOneByTenant(tenantId, { where: { id } as any });
        if (!entity) {
            throw new Error(`Entity with ID ${id} not found for tenant ${tenantId}`);
        }
        await this.softRemove(entity);
    }
}

export default TenantAwareRepository;
