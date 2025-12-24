import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSuspension } from '@valentine-efagene/qshelter-common';
import { UserSuspensionController } from './user_suspensions.controller';
import { UserSuspensionService } from './user_suspensions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserSuspension])],
  providers: [UserSuspensionService],
  controllers: [UserSuspensionController],
  exports: [UserSuspensionService]
})
export class UserSuspensionModule { }
