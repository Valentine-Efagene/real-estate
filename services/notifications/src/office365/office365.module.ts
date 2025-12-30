import { Module } from '@nestjs/common';
import Office365Service from './office365.service';

@Module({
  controllers: [],
  providers: [Office365Service],
  exports: [Office365Service]
})
export class Office365Module { } 