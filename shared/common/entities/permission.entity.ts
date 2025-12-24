import { Column, Entity, ManyToMany } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Role } from './role.entity';

@Entity({ name: 'permissions' })
export class Permission extends BaseEntity {
  @Column({ type: 'varchar', nullable: true })
  name: string;

  @ManyToMany(() => Role, role => role.permissions)
  roles: Role[]
}
