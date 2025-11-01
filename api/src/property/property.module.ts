import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './property.entity';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';
import { PropertyMediaModule } from '../property-media/property-media.module';

@Module({
  imports: [TypeOrmModule.forFeature([Property]), S3UploaderModule, PropertyMediaModule],
  providers: [PropertyService],
  controllers: [PropertyController],
  exports: [PropertyService]
})
export class PropertyModule { }
