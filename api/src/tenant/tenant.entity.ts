import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/helpers/BaseEntity';
import { TenantStatus, TenantPlan } from './tenant.enums';

@Entity({ name: 'tenants' })
@Unique(['subdomain'])
@Unique(['domain'])
export class Tenant extends BaseEntity {
    @Column({ length: 255 })
    name: string;

    @Column({ length: 100, unique: true })
    @Index()
    subdomain: string; // e.g., 'acme' for acme.yourdomain.com

    @Column({ length: 255, nullable: true, unique: true })
    domain: string; // Optional custom domain: e.g., 'realestate.acme.com'

    @Column({ type: 'varchar', default: TenantStatus.ACTIVE })
    status: TenantStatus;

    @Column({ type: 'varchar', default: TenantPlan.FREE })
    plan: TenantPlan;

    @Column({ type: 'json', nullable: true })
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

    @Column({ type: 'json', nullable: true })
    metadata: any; // Additional tenant-specific metadata

    @Column({ type: 'timestamp', nullable: true })
    trialEndsAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    subscriptionEndsAt: Date;

    // Contact information
    @Column({ length: 255, nullable: true })
    contactEmail: string;

    @Column({ length: 50, nullable: true })
    contactPhone: string;

    // Database strategy (for future use if migrating to separate databases per tenant)
    @Column({ type: 'varchar', default: 'shared' })
    databaseStrategy: 'shared' | 'isolated';

    @Column({ length: 255, nullable: true })
    databaseHost: string;

    @Column({ length: 100, nullable: true })
    databaseName: string;
}

export default Tenant;
