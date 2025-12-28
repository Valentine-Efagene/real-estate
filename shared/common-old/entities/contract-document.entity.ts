import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Contract } from './contract.entity';
import { User } from './user.entity';

/**
 * Document Type for Contracts
 */
export enum ContractDocumentType {
    CONTRACT = 'CONTRACT',                   // Main contract
    ADDENDUM = 'ADDENDUM',                   // Contract addendum
    AMENDMENT = 'AMENDMENT',                 // Contract amendment
    DISCLOSURE = 'DISCLOSURE',               // Legal disclosure
    PROOF_OF_INCOME = 'PROOF_OF_INCOME',    // Income verification
    PROOF_OF_ID = 'PROOF_OF_ID',            // ID verification
    CREDIT_REPORT = 'CREDIT_REPORT',        // Credit report
    BANK_STATEMENT = 'BANK_STATEMENT',      // Bank statement
    TITLE_DEED = 'TITLE_DEED',              // Property title
    APPRAISAL = 'APPRAISAL',                // Property appraisal
    INSPECTION = 'INSPECTION',               // Property inspection
    INSURANCE = 'INSURANCE',                 // Insurance policy
    OTHER = 'OTHER',
}

/**
 * ContractDocument - Documents associated with a contract
 * Separate from payment mechanics, focuses on legal/compliance docs
 */
@Entity({ name: 'contract_document' })
export class ContractDocument extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Contract, (contract) => contract.documents, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'contract_id' })
    contract: Contract;

    @Column({ name: 'contract_id' })
    contractId: number;

    @Column({ type: 'enum', enum: ContractDocumentType })
    documentType: ContractDocumentType;

    @Column({ type: 'varchar', length: 255 })
    fileName: string;

    @Column({ nullable: true })
    url: string;

    @Column({ nullable: true })
    mimeType: string;

    @Column({ name: 'file_size', type: 'int', nullable: true })
    fileSize: number;

    @Column({ type: 'boolean', default: false })
    isRequired: boolean;

    @Column({ type: 'boolean', default: false })
    isTemplate: boolean; // If this is a template/placeholder

    @Column({ type: 'text', nullable: true })
    description: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'uploaded_by' })
    uploadedBy: User;

    @Column({ name: 'uploaded_by', nullable: true })
    uploadedById: number;

    @Column({ name: 'uploaded_at', type: 'timestamp', nullable: true })
    uploadedAt: Date;

    @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
    verifiedAt: Date;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'verified_by' })
    verifiedBy: User;

    @Column({ name: 'verified_by', nullable: true })
    verifiedById: number;

    @Column({ type: 'int', default: 0 })
    version: number; // Version number for document revisions

    @Column({ type: 'json', nullable: true })
    metadata: any;
}

export default ContractDocument;
