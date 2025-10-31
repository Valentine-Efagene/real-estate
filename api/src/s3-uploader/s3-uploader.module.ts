import { Module } from '@nestjs/common';
import { S3UploaderService } from './s3-uploader.service';
import { S3UploaderController } from './s3-uploader.controller';

@Module({
  providers: [S3UploaderService],
  controllers: [S3UploaderController],
  exports: [S3UploaderService]
})
export class S3UploaderModule { }
