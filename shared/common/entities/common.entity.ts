import { User } from './user.entity';
import {
  ManyToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { DocumentStatus } from '../types/common.type';
import { AbstractTenantAwareEntity } from './common.pure.entity';

export abstract class AbstractBaseReviewableEntity extends AbstractTenantAwareEntity {
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: string;
}

export abstract class AbstractBaseDocumentEntity extends AbstractBaseReviewableEntity {
  @Column({
    name: 'status',
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status: DocumentStatus;

  @Column({ name: 'comment', nullable: true })
  comment: string;

  @Column({ name: 'url', type: 'text', nullable: false })
  url: string;

  @Column({ name: 'description', nullable: true })
  description: string;

  @Column({ name: 'name', nullable: true })
  name: string;

  @Column({ name: 'size', nullable: false, comment: "In bytes" })
  size: number
}

export abstract class AbstractBaseMediaEntity extends AbstractBaseDocumentEntity {
  // @Column()
  // mimeType: string;
}
