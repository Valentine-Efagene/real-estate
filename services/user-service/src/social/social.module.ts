import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Social } from './social.entity';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [TypeOrmModule.forFeature([Social])],
  providers: [SocialService],
  controllers: [SocialController],
  exports: [SocialService]
})
export class SocialModule { }
