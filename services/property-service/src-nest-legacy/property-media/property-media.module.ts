import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyMedia } from '@valentine-efagene/qshelter-common';
import { PropertyMediaController } from './property-media.controller';
import { PropertyMediaService } from './property-media.service';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyMedia])],
  providers: [PropertyMediaService],
  controllers: [PropertyMediaController],
  exports: [PropertyMediaService],
})
export class PropertyMediaModule { }
