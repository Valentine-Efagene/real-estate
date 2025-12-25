import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';
import { User } from './user.entity';

@Entity({ name: 'device_endpoints' })
export class DeviceEndpoint extends AbstractBaseEntity {
  @Column({ name: 'user_id', nullable: false })
  userId: number;

  @ManyToOne(() => User, user => user.deviceEndpoints)
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ name: 'user_agent', nullable: false })
  userAgent: string;

  @Column({ name: 'endpoint_arn', nullable: true })
  endpointArn: string;

  @Column({ name: 'token', nullable: true })
  token: string;

  @Column({
    name: 'user_data',
    nullable: true
  })
  userData: string
}
