import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Property } from '../property/property.entity';
import { AbstractBaseDocumentEntity } from '@valentine-efagene/qshelter-common';

@Entity({ name: 'property-document' })
export class PropertyDocument extends AbstractBaseDocumentEntity {
  @ManyToOne(() => Property, (property) => property.documents, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column()
  propertyId: number;
}
