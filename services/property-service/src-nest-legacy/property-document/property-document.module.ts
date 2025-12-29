import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyDocument } from '@valentine-efagene/qshelter-common';
import { PropertyDocumentController } from './property-document.controller';
import { PropertyDocumentService } from './property-document.service';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyDocument])],
  providers: [PropertyDocumentService],
  controllers: [PropertyDocumentController],
  exports: [PropertyDocumentService],
})
export class PropertyDocumentModule { }
