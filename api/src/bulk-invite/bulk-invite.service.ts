import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJobNames } from './bulk-invite.type';
import { QueueNames } from '../common/common.enum';
import { BulkInviteDto } from './bulk-invite.dto';

@Injectable()
export class BulkInviteService {
  private readonly logger = new Logger(BulkInviteService.name);

  constructor(
    @InjectQueue(QueueNames.BULK_INVITE) private queue: Queue
  ) { }

  async queueStaffInvites(dto: BulkInviteDto): Promise<void> {
    await this.queue.add(QueueJobNames.BULK_STAFF_INVITE, dto)
  }

  async test(data: string): Promise<void> {
    await this.queue.add(QueueJobNames.TEST, data)
  }
}
