import { Entity, Column, Index, Unique, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { TenantStatus, TenantPlan } from '../types/tenant.type';

@Entity({ name: 'tenants' })
@Unique(['subdomain'])
@Unique(['domain'])
export class Tenant {
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

    @Column({ name: 'name', length: 255 })
    name: string;

    @Column({ name: 'subdomain', length: 100, unique: true })
    @Index()
    subdomain: string; // e.g., 'acme' for acme.yourdomain.com

    @Column({ name: 'domain', length: 255, nullable: true, unique: true })
    domain: string; // Optional custom domain: e.g., 'realestate.acme.com'

    @Column({ name: 'status', type: 'varchar', default: TenantStatus.ACTIVE })
    status: TenantStatus;

    @Column({ name: 'plan', type: 'varchar', default: TenantPlan.FREE })
    plan: TenantPlan;

    @Column({ name: 'config', type: 'json', nullable: true })
    config: {
        maxUsers?: number;
        maxProperties?: number;
        features?: string[];
        customBranding?: {
            logo?: string;
            primaryColor?: string;
            secondaryColor?: string;
        };
        [key: string]: any;
    };

    @Column({ name: 'metadata', type: 'json', nullable: true })
    metadata: any; // Additional tenant-specific metadata

    @Column({ name: 'trial_ends_at', type: 'timestamp', nullable: true })
    trialEndsAt: Date;

    @Column({ name: 'subscription_ends_at', type: 'timestamp', nullable: true })
    subscriptionEndsAt: Date;

    // Contact information
    @Column({ name: 'contact_email', length: 255, nullable: true })
    contactEmail: string;

    @Column({ name: 'contact_phone', length: 50, nullable: true })
    contactPhone: string;

    // Database strategy (for future use if migrating to separate databases per tenant)
    @Column({ name: 'database_strategy', type: 'varchar', default: 'shared' })
    databaseStrategy: 'shared' | 'isolated';

    @Column({ name: 'database_host', length: 255, nullable: true })
    databaseHost: string;

    @Column({ name: 'database_name', length: 100, nullable: true })
    databaseName: string;
}

export default Tenant;
