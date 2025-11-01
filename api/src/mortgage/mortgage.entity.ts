import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AbstractBaseReviewableEntity } from 'src/common/common.entity';
import { Property } from 'src/property/property.entity';
import { User } from '../user/user.entity';
import MortgageDocument from './mortgage-document.entity';
import MortgageStep from './mortgage-step.entity';
import { MortgageType } from 'src/mortgage-type/mortgage-type.entity';

export enum MortgageStatus {
    DRAFT = 'DRAFT',
    PENDING = 'PENDING',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

@Entity({ name: 'mortgage' })
export class Mortgage extends AbstractBaseReviewableEntity {
    @ManyToOne(() => Property, (property) => property.mortgages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ nullable: true })
    propertyId: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'borrower_id' })
    borrower: User;

    @Column({ nullable: true })
    borrowerId: number;

    @Column({ type: 'double precision', nullable: true })
    principal: number;

    @Column({ type: 'double precision', nullable: true })
    downPayment: number;

    @Column({ type: 'int', nullable: true })
    termMonths: number;

    @Column({ type: 'double precision', nullable: true })
    interestRate: number;

    @Column({ type: 'double precision', nullable: true })
    monthlyPayment: number;

    @Column({ type: 'enum', enum: MortgageStatus, default: MortgageStatus.DRAFT })
    status: MortgageStatus;

    @OneToMany(() => MortgageDocument, (doc) => doc.mortgage)
    documents: MortgageDocument[];

    @OneToMany(() => MortgageStep, (step) => step.mortgage, { cascade: true })
    steps: MortgageStep[];

    @ManyToOne(() => MortgageType, { nullable: true })
    @JoinColumn({ name: 'mortgage_type_id' })
    mortgageType: MortgageType;

    @Column({ nullable: true })
    mortgageTypeId: number;
}

export default Mortgage;
