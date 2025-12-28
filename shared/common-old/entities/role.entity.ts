import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Permission } from './permission.entity';
import { User } from './user.entity';
import { AbstractBaseEntity } from './common.pure.entity';

@Entity({ name: 'roles' })
export class Role extends AbstractBaseEntity {
  @Column({ name: 'name', nullable: true })
  name: string;

  @ManyToMany(() => Permission, (permission) => permission.roles, {
    onDelete: 'CASCADE',
    eager: true
  })
  @JoinTable()
  permissions: Permission[]

  @ManyToMany(() => User, (user) => user.roles)
  users: User[]
}
