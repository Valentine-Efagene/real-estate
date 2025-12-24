import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { AbstractBaseReviewableEntity } from './common.entity';

@Entity({ name: 'social' })
export class Social extends AbstractBaseReviewableEntity {
  @ManyToOne(() => User, {
    //eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  userId: number;

  @Column({
    nullable: true,
  })
  brand: string;

  @Column({
    nullable: true,
  })
  link: string;
}
