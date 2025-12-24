import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { PropertyMedia } from './property-media.entity';
import { User } from './user.entity';
import { AbstractBaseReviewableEntity } from './common.entity';
import { Status } from '../types/common.type';

@Entity({ name: 'settings' })
export class Settings extends AbstractBaseReviewableEntity {
  @ManyToOne(() => User, {
    //eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ nullable: true })
  createdBy: number;

  @OneToMany(
    () => PropertyMedia,
    (PropertyMedia) => PropertyMedia.property,
  )
  media: PropertyMedia[];

  @Column({ nullable: true })
  title: string;

  @Column()
  location: string;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ default: true })
  isPrivate: boolean;

  @Column({ nullable: true })
  qrOfflineCode: string;

  @Column({
    type: 'text',
    nullable: true
  })
  description: string

  @Column({
    type: 'enum',
    enum: Status,
    default: Status.PENDING,
  })
  status: Status;
}
