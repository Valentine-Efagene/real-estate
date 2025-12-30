import { Module } from '@nestjs/common';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';

@Module({
  imports: [
  ],
  providers: [CommonService],
  controllers: [CommonController],
  exports: [],
})
export class CommonModule { }
