import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { User } from './user.entity';

@Entity({ name: 'user_suspension' })
export class UserSuspension extends AbstractBaseEntity {
  @OneToOne(() => User, {
    //eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'user_id',
    nullable: false
  })
  userId: number

  @Column({
    name: 'reason',
    nullable: false
  })
  reason: string
}
