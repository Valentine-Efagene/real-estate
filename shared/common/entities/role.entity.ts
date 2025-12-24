import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Permission } from './permission.entity';
import { User } from './user.entity';
import { BaseEntity } from './BaseEntity';

@Entity({ name: 'roles' })
export class Role extends BaseEntity {
  @Column({ nullable: true })
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
