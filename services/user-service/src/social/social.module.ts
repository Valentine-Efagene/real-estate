import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { Social } from '@valentine-efagene/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Social])],
  providers: [SocialService],
  controllers: [SocialController],
  exports: [SocialService]
})
export class SocialModule { }
