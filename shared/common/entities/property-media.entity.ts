import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Property } from './property.entity';
import { AbstractBaseMediaEntity } from './common.entity';

@Entity({ name: 'property_media' })
export class PropertyMedia extends AbstractBaseMediaEntity {
  @ManyToOne(() => Property, (property) => property.media, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({
    nullable: false
  })
  propertyId: number
}
