import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Mortgage } from './mortgage.entity';
import { User } from './user.entity';

@Entity({ name: 'mortgage_document' })
export class MortgageDocument extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Mortgage, (mortgage) => mortgage.documents, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'mortgage_id' })
    mortgage: Mortgage;

    @Column({ nullable: true })
    mortgageId: number;

    @Column()
    fileName: string;

    // Allow null URLs for template/placeholder documents created from mortgage type templates.
    @Column({ nullable: true })
    url: string;

    // Flag to mark this document as a template/placeholder (not yet uploaded). Template docs typically have a name but no URL.
    @Column({ default: false })
    isTemplate: boolean;

    @Column({ nullable: true })
    mimeType: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'uploaded_by' })
    uploadedBy: User;

    @Column({ nullable: true })
    uploadedById: number;
}

export default MortgageDocument;
