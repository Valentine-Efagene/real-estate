import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Mortgage } from './mortgage.entity';
import { User } from './user.entity';

@Entity({ name: 'mortgage_document' })
export class MortgageDocument extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Mortgage, (mortgage) => mortgage.documents, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'mortgage_id' })
    mortgage: Mortgage;

    @Column({ name: 'mortgage_id', nullable: true })
    mortgageId: number;

    @Column({ name: 'file_name' })
    fileName: string;

    // Allow null URLs for template/placeholder documents created from mortgage type templates.
    @Column({ name: 'url', nullable: true })
    url: string;

    // Flag to mark this document as a template/placeholder (not yet uploaded). Template docs typically have a name but no URL.
    @Column({ name: 'is_template', default: false })
    isTemplate: boolean;

    @Column({ name: 'mime_type', nullable: true })
    mimeType: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'uploaded_by' })
    uploadedBy: User;

    @Column({ name: 'uploaded_by_id', nullable: true })
    uploadedById: number;
}

export default MortgageDocument;
