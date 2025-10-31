import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/helpers/BaseEntity';

@Entity({ name: 'amenity' })
export class Amenity extends BaseEntity {
  @Column({
    nullable: false
  })
  name: string
}
