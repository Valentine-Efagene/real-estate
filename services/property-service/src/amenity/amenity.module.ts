import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Amenity } from '@valentine-efagene/entities';
import { AmenityController } from './amenity.controller';
import { AmenityService } from './amenity.service';

@Module({
  imports: [TypeOrmModule.forFeature([Amenity])],
  providers: [AmenityService],
  controllers: [AmenityController],
  exports: [AmenityService]
})
export class AmenityModule { }
