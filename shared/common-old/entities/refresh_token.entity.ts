import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { User } from './user.entity';

@Entity({ name: 'refresh_tokens' })
export class RefreshToken extends AbstractBaseEntity {
  @ManyToOne(() => User, (user) => user.refreshTokens)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @Column({ name: 'token', nullable: false, type: 'text' })
  token: string;
}
