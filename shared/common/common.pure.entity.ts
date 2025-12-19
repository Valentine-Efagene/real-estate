
import { CreateDateColumn, DeleteDateColumn, PrimaryGeneratedColumn, UpdateDateColumn, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { Tenant } from "../tenant/tenant.entity";


export abstract class AbstractBaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date;

    @DeleteDateColumn({ nullable: true, default: null })
    deletedAt: Date;
}

/**
 * Tenant-aware base entity
 * All entities that need tenant isolation should extend this
 */
export abstract class AbstractTenantAwareEntity extends AbstractBaseEntity {
    @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Tenant;

    @Column({ name: 'tenant_id' })
    @Index()
    tenantId: number;
}
