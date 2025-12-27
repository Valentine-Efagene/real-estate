import { Column, DeleteDateColumn, Entity, JoinColumn, OneToOne } from 'typeorm';
import { User } from './user.entity';
import { AbstractBaseEntity } from './common.pure.entity';

@Entity({ name: 'password_reset_token' })
export class PasswordResetToken extends AbstractBaseEntity {
  @OneToOne(() => User, {
    //eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'token_hash',
    nullable: true
  })
  tokenHash: string

  @DeleteDateColumn({
    name: 'expires_at',
    nullable: true,
    default: null
  })
  expiresAt: Date;
}
