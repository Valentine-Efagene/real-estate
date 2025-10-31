import { Column, Entity, JoinTable, ManyToMany, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../common/helpers/BaseEntity';
import { UserStatus } from './user.enums';
import { Role } from '../role/role.entity';
import { RefreshToken } from '../refresh_token/refresh_token.entity';
import { Property } from '../property/property.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true, type: 'text' })
  bio?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ type: 'text', nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  gender: string;

  @ManyToMany(() => Role, (role) => role.users, {
    onDelete: 'CASCADE',
    eager: true
  })
  @JoinTable()
  roles?: Role[]

  @OneToMany(
    () => RefreshToken,
    (refreshToken) =>
      refreshToken.user,
    { eager: true },
  )
  refreshTokens: RefreshToken[];

  @OneToMany(
    () => Property,
    (property) =>
      property.user,
  )
  properties: Property[];

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING
  })
  status: UserStatus

  @Column({ default: false })
  isEmailVerified?: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string | null
}
