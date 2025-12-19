import { Module } from '@nestjs/common';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';

@Module({
  imports: [
    S3UploaderModule,
  ],
  providers: [CommonService],
  controllers: [CommonController],
  exports: [],
})
export class CommonModule { }
