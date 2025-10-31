import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne
} from 'typeorm';
import { User } from '../user/user.entity';
import { AbstractBaseReviewableEntity } from '../common/common.entity';
import { AccessLog } from '../access-log/access-log.entity';
import { EventTicketType } from '../event-ticket-type/event-ticket-type.entity';
import { Order } from '../order/order.entity';
import { TicketRSVPStatus } from './ticket.enums';

@Entity({ name: 'tickets' })
export class Ticket extends AbstractBaseReviewableEntity {
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  userId: number;

  @ManyToOne(() => Order, order => order.tickets, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    comment: 'For resolving payment disputes, and running resolution CRON.'
  })
  orderId: number

  @ManyToOne(() => EventTicketType, eventTicketType => eventTicketType.tickets, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'event_ticket_type_id' })
  eventTicketType: EventTicketType;

  @Column()
  eventTicketTypeId: number

  @Column({ nullable: true, comment: "If it's a gift" })
  guestFirstName?: string;

  @Column({ nullable: true, comment: "If it's a gift" })
  guestLastName?: string;

  @Column({ nullable: true, comment: "If it's a gift" })
  guestEmail?: string;

  @Column({ nullable: true, comment: "If it's a gift" })
  guestPhone?: string;

  @Column({ default: false })
  wasGifted: boolean; // true if admin sent it manually

  @Column({ nullable: true })
  issuedAt: Date;

  @Column({ nullable: false })
  nonce: string;

  @Column({ nullable: true })
  checkedInAt?: Date;

  @Column({
    type: 'int',
    default: 0
  })
  resassignCount: number

  @Column({
    type: 'enum',
    enum: TicketRSVPStatus,
    default: TicketRSVPStatus.PENDING
  })
  rsvpStatus: TicketRSVPStatus;

  @Column({
    unique: true,
    comment: 'Unique verification token for the ticket'
  })
  verificationToken: string;

  @Column({
    unique: true,
    comment: 'Unique QR code image for the ticket'
  })
  qrCodeImage: string;

  @OneToOne(() => AccessLog, log => log.ticket, { onDelete: 'CASCADE', })
  accessLog: AccessLog;
}
