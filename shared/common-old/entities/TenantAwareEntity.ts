import { CreateDateColumn, DeleteDateColumn, PrimaryGeneratedColumn, UpdateDateColumn, Column, Index, ManyToOne, JoinColumn } from 'typeorm';

/**
 * Base entity with tenant support
 * All entities that need to be isolated by tenant should extend this
 */
export class TenantAwareEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => require('./tenant.entity').default, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'tenant_id' })
    tenant: any;

    @Column({ name: 'tenant_id' })
    @Index()
    tenantId: number;

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

export default TenantAwareEntity;
