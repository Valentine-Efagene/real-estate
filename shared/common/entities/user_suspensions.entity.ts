import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { User } from './user.entity';

@Entity({ name: 'user_suspension' })
export class UserSuspension extends BaseEntity {
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
