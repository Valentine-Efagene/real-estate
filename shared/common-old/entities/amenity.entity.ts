import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';

@Entity({ name: 'amenity' })
export class Amenity extends AbstractBaseEntity {
  @Column({
    name: 'name',
    nullable: false
  })
  name: string
}
