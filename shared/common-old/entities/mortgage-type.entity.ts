import { Column, Entity } from 'typeorm';
import { AbstractBaseReviewableEntity } from './common.entity';

/**
 * MortgageType stores named mortgage configurations. Examples: 'Standard Fixed', 'Interest Only', 'Buy-to-Let'.
 * - defaultSteps: array of step templates { title, description?, sequence?, isOptional? }
 * - requiredDocuments: array of document templates { name, required: boolean }
 * - config: free-form JSON for additional settings
 */
@Entity({ name: 'mortgage_type' })
export class MortgageType extends AbstractBaseReviewableEntity {
    @Column({ name: 'name' })
    name: string;

    @Column({ name: 'slug', nullable: true })
    slug: string;

    @Column({ name: 'description', type: 'text', nullable: true })
    description?: string;

    @Column({ name: 'default_steps', type: 'json', nullable: true })
    defaultSteps?: any[];

    @Column({ name: 'required_documents', type: 'json', nullable: true })
    requiredDocuments?: any[];

    @Column({ name: 'config', type: 'json', nullable: true })
    config?: any;
}

export default MortgageType;
