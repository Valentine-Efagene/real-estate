import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyMedia } from '@valentine-efagene/qshelter-common';
import { PropertyMediaController } from './property-media.controller';
import { PropertyMediaService } from './property-media.service';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyMedia]), S3UploaderModule],
  providers: [PropertyMediaService],
  controllers: [PropertyMediaController],
  exports: [PropertyMediaService],
})
export class PropertyMediaModule { }
