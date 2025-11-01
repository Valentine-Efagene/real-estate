import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseReviewableEntity } from 'src/common/common.entity';
import { Mortgage } from './mortgage.entity';
import { User } from 'src/user/user.entity';

@Entity({ name: 'mortgage_document' })
export class MortgageDocument extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Mortgage, (mortgage) => mortgage.documents, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'mortgage_id' })
    mortgage: Mortgage;

    @Column({ nullable: true })
    mortgageId: number;

    @Column()
    fileName: string;

    @Column()
    url: string;

    @Column({ nullable: true })
    mimeType: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'uploaded_by' })
    uploadedBy: User;

    @Column({ nullable: true })
    uploadedById: number;
}

export default MortgageDocument;
