import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSuspension } from './user_suspensions.entity';
import { UserSuspensionController } from './user_suspensions.controller';
import { UserSuspensionService } from './user_suspensions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSuspension])],
  providers: [UserSuspensionService],
  controllers: [UserSuspensionController],
  exports: [UserSuspensionService]
})
export class UserSuspensionModule { }
