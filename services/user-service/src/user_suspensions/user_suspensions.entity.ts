import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../common/helpers/BaseEntity';
import { User } from '../user/user.entity';

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
    nullable: false
  })
  userId: number

  @Column({
    nullable: false
  })
  reason: string
}
