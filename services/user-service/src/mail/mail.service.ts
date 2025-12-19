import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { SendMailDto, SendPasswordResetMailDto, SendTicketMailDto, SendVerificationMailDto, SendPaymentReminderDto } from './mail.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MailQueueJobNames } from './mail.enums';
import { QueueNames } from '../common/common.enum';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private mailerService: MailerService,
    @InjectQueue(QueueNames.EMAIL) private mailQueue: Queue
  ) { }

  async send(testMailDto: SendMailDto): Promise<void> {
    await this.mailerService.sendMail({
      to: testMailDto.receiverEmail,
      subject: 'Test Email',
      template: './test',
      context: {
        name: testMailDto.name,
        message: testMailDto.message
      }
    })
  }

  async sendQueued(mailDto: SendMailDto): Promise<void> {
    const job = await this.mailQueue.add(MailQueueJobNames.SEND, mailDto)
  }

  async sendTicketEmail(mailDto: SendTicketMailDto): Promise<void> {
    const job = await this.mailQueue.add(MailQueueJobNames.SEND_TICKET, mailDto)
  }

  async sendEmailVerification(mailDto: SendVerificationMailDto): Promise<void> {
    const job = await this.mailQueue.add(MailQueueJobNames.SEND_VERIFICATION_MESSAGE, mailDto)
  }

  async sendPasswordResetEmail(mailDto: SendPasswordResetMailDto): Promise<void> {
    const job = await this.mailQueue.add(MailQueueJobNames.SEND_PASSWORD_RESET_MESSAGE, mailDto)
  }

  async sendPaymentReminder(mailDto: SendPaymentReminderDto): Promise<void> {
    const job = await this.mailQueue.add(MailQueueJobNames.SEND_PAYMENT_REMINDER, mailDto)
  }
}
