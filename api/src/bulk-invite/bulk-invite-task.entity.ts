import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/helpers/BaseEntity';
import { User } from '../user/user.entity';
import { BulkInvitationTaskStatus } from './bulk-invite.type';

@Entity({ name: 'bulk_invite_tasks' })
export class BulkInviteTask extends BaseEntity {
  @ManyToOne(() => User, {
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
    type: 'text',
    comment: 'CSV file URL'
  })
  url: string

  @Column({
    type: 'enum',
    enum: BulkInvitationTaskStatus,
    default: BulkInvitationTaskStatus.INITIATED
  })
  status: BulkInvitationTaskStatus
}
