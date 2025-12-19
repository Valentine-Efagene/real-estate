import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetToken } from './password_reset_tokens.entity';
import { PasswordResetTokenController } from './password_reset_tokens.controller';
import { PasswordResetTokenService } from './password_reset_tokens.service';

@Module({
  imports: [TypeOrmModule.forFeature([PasswordResetToken])],
  providers: [PasswordResetTokenService],
  controllers: [PasswordResetTokenController],
  exports: [PasswordResetTokenService]
})
export class PasswordResetTokenModule { }
