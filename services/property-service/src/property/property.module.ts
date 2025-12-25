import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from '@valentine-efagene/qshelter-common';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { PropertyMediaModule } from '../property-media/property-media.module';
import { PropertyMedia } from '../property-media/property-media.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property, PropertyMedia]), PropertyMediaModule],
  providers: [PropertyService],
  controllers: [PropertyController],
  exports: [PropertyService]
})
export class PropertyModule { }
