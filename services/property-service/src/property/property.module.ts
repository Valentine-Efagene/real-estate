import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from '@valentine-efagene/qshelter-common';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';
import { PropertyMediaModule } from '../property-media/property-media.module';
import { PropertyMedia } from '../property-media/property-media.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property, PropertyMedia]), S3UploaderModule, PropertyMediaModule],
  providers: [PropertyService],
  controllers: [PropertyController],
  exports: [PropertyService]
})
export class PropertyModule { }
