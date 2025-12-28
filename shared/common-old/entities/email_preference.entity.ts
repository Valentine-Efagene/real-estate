import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from './common.pure.entity';

@Entity({ name: 'email_preferrences' })
export class EmailPreference extends AbstractBaseEntity {
  @Column({
    name: 'email',
    nullable: false,
    unique: true,
  })
  email: string;

  @Column({
    name: 'unsubscribe_token',
    nullable: true,
    unique: true
  })
  unsubscribeToken: string

  @Column({
    name: 'un_subscribed',
    type: 'bool',
    default: false
  })
  unSubscribed: boolean
}
