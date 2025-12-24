import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from './common.entity';
import { PaymentPlan } from './payment-plan.entity';
import { User } from './user.entity';
import { Property } from './property.entity';
import { ContractDocument } from './contract-document.entity';

/**
 * Contract Type
 */
export enum ContractType {
    MORTGAGE = 'MORTGAGE',
    SALE_AGREEMENT = 'SALE_AGREEMENT',
    LEASE_AGREEMENT = 'LEASE_AGREEMENT',
    RENT_TO_OWN = 'RENT_TO_OWN',
    INSTALLMENT_SALE = 'INSTALLMENT_SALE',
    OPTION_TO_PURCHASE = 'OPTION_TO_PURCHASE',
    CUSTOM = 'CUSTOM',
}

/**
 * Contract Status
 */
export enum ContractStatus {
    DRAFT = 'DRAFT',
    PENDING_SIGNATURE = 'PENDING_SIGNATURE',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    TERMINATED = 'TERMINATED',
    EXPIRED = 'EXPIRED',
    CANCELLED = 'CANCELLED',
}

/**
 * Contract - Legal agreement separate from payment mechanics
 * Handles documentation, signatures, terms, and legal aspects
 */
@Entity({ name: 'contract' })
export class Contract extends AbstractBaseReviewableEntity {
    @OneToOne(() => PaymentPlan, (plan) => plan.contract, { nullable: true })
    @JoinColumn({ name: 'payment_plan_id' })
    paymentPlan: PaymentPlan;

    @Column({ name: 'payment_plan_id', nullable: true })
    paymentPlanId: number;

    @ManyToOne(() => Property, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ name: 'property_id' })
    propertyId: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'buyer_id' })
    buyer: User;

    @Column({ name: 'buyer_id', nullable: true })
    buyerId: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'seller_id' })
    seller: User;

    @Column({ name: 'seller_id', nullable: true })
    sellerId: number;

    // Contract Details
    @Column({ type: 'enum', enum: ContractType })
    contractType: ContractType;

    @Column({ type: 'varchar', length: 100, unique: true })
    contractNumber: string; // Unique contract identifier

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'enum', enum: ContractStatus, default: ContractStatus.DRAFT })
    status: ContractStatus;

    // Dates
    @Column({ name: 'start_date', type: 'date', nullable: true })
    startDate: Date;

    @Column({ name: 'end_date', type: 'date', nullable: true })
    endDate: Date;

    @Column({ name: 'expiry_date', type: 'date', nullable: true })
    expiryDate: Date;

    @Column({ name: 'signed_at', type: 'timestamp', nullable: true })
    signedAt: Date;

    @Column({ name: 'executed_at', type: 'timestamp', nullable: true })
    executedAt: Date;

    // Signatures
    @Column({ name: 'buyer_signed', type: 'boolean', default: false })
    buyerSigned: boolean;

    @Column({ name: 'buyer_signed_at', type: 'timestamp', nullable: true })
    buyerSignedAt: Date;

    @Column({ name: 'buyer_signature_url', nullable: true })
    buyerSignatureUrl: string;

    @Column({ name: 'seller_signed', type: 'boolean', default: false })
    sellerSigned: boolean;

    @Column({ name: 'seller_signed_at', type: 'timestamp', nullable: true })
    sellerSignedAt: Date;

    @Column({ name: 'seller_signature_url', nullable: true })
    sellerSignatureUrl: string;

    @Column({ name: 'witness_signed', type: 'boolean', default: false })
    witnessSigned: boolean;

    @Column({ name: 'witness_signed_at', type: 'timestamp', nullable: true })
    witnessSignedAt: Date;

    @Column({ name: 'witness_name', nullable: true })
    witnessName: string;

    // Contract URLs
    @Column({ name: 'contract_url', nullable: true })
    contractUrl: string; // URL to signed contract PDF

    @Column({ name: 'template_url', nullable: true })
    templateUrl: string; // URL to contract template used

    // Legal Details
    @Column({ type: 'text', nullable: true })
    terms: string; // Contract terms and conditions

    @Column({ name: 'governing_law', nullable: true })
    governingLaw: string; // e.g., "State of California"

    @Column({ nullable: true })
    jurisdiction: string;

    // Relations
    @OneToMany(() => ContractDocument, (doc) => doc.contract, { cascade: true })
    documents: ContractDocument[];

    // Metadata
    @Column({ type: 'json', nullable: true })
    metadata: any; // Flexible field for contract-specific data

    @Column({ type: 'json', nullable: true })
    clauses: any; // Structured clauses/sections
}

export default Contract;
