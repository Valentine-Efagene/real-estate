import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { TenantAwareBaseEntity } from './BaseEntity';
import { UserStatus } from '../types/user.enums';
import { Role } from './role.entity';
import { RefreshToken } from './refresh_token.entity';
import { Property } from './property.entity';
import { Transaction } from './transaction.entity';
import { Wallet } from './wallet.entity';

@Entity({ name: 'users' })
export class User extends TenantAwareBaseEntity {
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
    () => Wallet,
    (wallet) =>
      wallet.user,
    { eager: true },
  )
  wallets: Wallet[];

  @OneToMany(
    () => Transaction,
    (transaction) =>
      transaction.user,
    { eager: true },
  )
  transactions: Transaction[];

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
