import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';
import { User } from '../user/user.entity';
import { QrCodeModule } from '../qr-code/qr-code.module';
import { TicketAuditLog } from '../ticket-audit-log/ticket-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, User, TicketAuditLog]), S3UploaderModule, QrCodeModule],
  providers: [TicketService],
  controllers: [TicketController],
  exports: [TicketService]
})
export class TicketModule { }
