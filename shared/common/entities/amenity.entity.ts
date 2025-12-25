import { Column, Entity } from 'typeorm';
import { BaseEntity } from './BaseEntity';

@Entity({ name: 'amenity' })
export class Amenity extends BaseEntity {
  @Column({
    name: 'name',
    nullable: false
  })
  name: string
}
