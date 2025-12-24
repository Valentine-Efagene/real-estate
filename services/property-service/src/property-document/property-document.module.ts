import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyDocument } from '@valentine-efagene/qshelter-common';
import { PropertyDocumentController } from './property-document.controller';
import { PropertyDocumentService } from './property-document.service';
import { S3UploaderModule } from '../s3-uploader/s3-uploader.module';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyDocument]), S3UploaderModule],
  providers: [PropertyDocumentService],
  controllers: [PropertyDocumentController],
  exports: [PropertyDocumentService],
})
export class PropertyDocumentModule { }
