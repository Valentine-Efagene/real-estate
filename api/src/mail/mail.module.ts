import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { join } from 'path';
import { BullModule } from '@nestjs/bullmq';
import { MailConsumer } from './mail.consumer';
import { TemplateTesterService } from './template-tester.service';
import { CustomeHandlebarsAdapter } from './custom-handlebars.adapter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../ticket/ticket.entity';
import { QueueNames } from '../common/common.enum';

@Module({
  imports: [
    MailerModule.forRoot({
      // transport: 'smtps://user@example.com:topsecret@smtp.example.com',
      // or
      transport: {
        host: process.env.MAIL_HOST,
        port: parseInt(process.env.MAIL_PORT, 10),
        secure: false,
        auth: {
          user: process.env.MAIL_USERNAME,
          pass: process.env.MAIL_PASSWORD,
        },
      },
      defaults: {
        from: process.env.MAIL_FROM_ADDRESS,
      },
      template: {
        dir: join(__dirname, 'templates'),
        adapter: new CustomeHandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
      options: {
        partials: {
          dir: join(__dirname, 'templates', 'partials')
        },
      }
    }),
    BullModule.registerQueue({
      name: QueueNames.EMAIL
    }),
    TypeOrmModule.forFeature([Ticket])
  ],
  providers: [MailService, MailConsumer, TemplateTesterService],
  controllers: [MailController],
  exports: [MailService]
})
export class MailModule { }
