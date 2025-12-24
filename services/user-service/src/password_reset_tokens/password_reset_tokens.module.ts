import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetTokenController } from './password_reset_tokens.controller';
import { PasswordResetTokenService } from './password_reset_tokens.service';
import { PasswordResetToken } from '@valentine-efagene/qshelter-common';

@Module({
  imports: [TypeOrmModule.forFeature([PasswordResetToken])],
  providers: [PasswordResetTokenService],
  controllers: [PasswordResetTokenController],
  exports: [PasswordResetTokenService]
})
export class PasswordResetTokenModule { }
