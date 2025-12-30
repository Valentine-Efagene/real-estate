import { Module } from '@nestjs/common';
import { SmsController } from './sms.controller';
import SmsService from './sms.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService]
})

export class SmsModule { }
