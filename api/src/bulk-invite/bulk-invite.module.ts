import { Module } from '@nestjs/common';
import { BulkInviteController } from './bulk-invite.controller';
import { BulkInviteService } from './bulk-invite.service';
import { BullModule } from '@nestjs/bullmq';
import { BulkInviteConsumer } from './bulk-invite.consumer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueNames } from '../common/common.enum';
import { User } from '../user/user.entity';
import { AuthModule } from '../auth/auth.module';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';
import { BulkInviteTask } from './bulk-invite-task.entity';
import { CsvService } from './csv.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueNames.BULK_INVITE
    }),
    TypeOrmModule.forFeature([User, BulkInviteTask]),
    AuthModule,
    S3UploaderModule,
  ],
  providers: [BulkInviteService, BulkInviteConsumer, CsvService],
  controllers: [BulkInviteController],
  exports: [BulkInviteService]
})
export class BulkInviteModule { }
