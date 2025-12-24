import { Column, Entity } from 'typeorm';
import { AbstractBaseReviewableEntity } from '@valentine-efagene/qshelter-common';

/**
 * MortgageType stores named mortgage configurations. Examples: 'Standard Fixed', 'Interest Only', 'Buy-to-Let'.
 * - defaultSteps: array of step templates { title, description?, sequence?, isOptional? }
 * - requiredDocuments: array of document templates { name, required: boolean }
 * - config: free-form JSON for additional settings
 */
@Entity({ name: 'mortgage_type' })
export class MortgageType extends AbstractBaseReviewableEntity {
    @Column()
    name: string;

    @Column({ nullable: true })
    slug: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'json', nullable: true })
    defaultSteps?: any[];

    @Column({ type: 'json', nullable: true })
    requiredDocuments?: any[];

    @Column({ type: 'json', nullable: true })
    config?: any;
}

export default MortgageType;
