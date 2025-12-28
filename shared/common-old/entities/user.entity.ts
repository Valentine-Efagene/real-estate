import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { AbstractTenantAwareEntity } from './common.pure.entity';
import { UserStatus } from '../types/user.type';
import { Role } from './role.entity';
import { RefreshToken } from './refresh_token.entity';
import { Property } from './property.entity';
import { Transaction } from './transaction.entity';
import { Wallet } from './wallet.entity';
import { DeviceEndpoint } from './device_endpoint.entity';

@Entity({ name: 'users' })
export class User extends AbstractTenantAwareEntity {
  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @OneToMany(() => DeviceEndpoint, deviceEndpoint => deviceEndpoint.user)
  deviceEndpoints: DeviceEndpoint[]

  @Column({ name: 'phone', nullable: true })
  phone?: string;

  @Column({ name: 'bio', nullable: true, type: 'text' })
  bio?: string;

  @Column({ name: 'address', nullable: true })
  address?: string;

  @Column({ name: 'email', nullable: true })
  email: string;

  @Column({ name: 'password', nullable: true })
  password: string;

  @Column({ name: 'avatar', type: 'text', nullable: true })
  avatar?: string;

  @Column({ name: 'gender', nullable: true })
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
    name: 'status',
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING
  })
  status: UserStatus

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified?: boolean;

  @Column({ name: 'email_verification_token', nullable: true })
  emailVerificationToken: string | null
}
