import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@valentine-efagene/qshelter-common';

@Entity({ name: 'amenity' })
export class Amenity extends BaseEntity {
  @Column({
    nullable: false
  })
  name: string
}
