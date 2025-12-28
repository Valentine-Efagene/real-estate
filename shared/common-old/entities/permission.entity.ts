import { Column, Entity, ManyToMany } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { Role } from './role.entity';

@Entity({ name: 'permissions' })
export class Permission extends AbstractBaseEntity {
  @Column({ name: 'name', type: 'varchar', nullable: true })
  name: string;

  @ManyToMany(() => Role, role => role.permissions)
  roles: Role[]
}
