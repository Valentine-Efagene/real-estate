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

  @Column({ name: 'created_by', nullable: true })
  createdBy: number;

  @OneToMany(
    () => PropertyMedia,
    (PropertyMedia) => PropertyMedia.property,
  )
  media: PropertyMedia[];

  @Column({ name: 'title', nullable: true })
  title: string;

  @Column({ name: 'location' })
  location: string;

  @Column({ name: 'start_time' })
  startTime: Date;

  @Column({ name: 'end_time' })
  endTime: Date;

  @Column({ name: 'is_private', default: true })
  isPrivate: boolean;

  @Column({ name: 'qr_offline_code', nullable: true })
  qrOfflineCode: string;

  @Column({
    name: 'description',
    type: 'text',
    nullable: true
  })
  description: string

  @Column({
    name: 'status',
    type: 'enum',
    enum: Status,
    default: Status.PENDING,
  })
  status: Status;
}
