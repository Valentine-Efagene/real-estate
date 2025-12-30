import { Module } from '@nestjs/common';
import { EmailPreferenceController } from './email_preference.controller';
import { EmailPreferenceService } from './email_preference.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailPreference } from '../../../../shared/common/entities/email_preference.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmailPreference])],
  providers: [EmailPreferenceService],
  controllers: [EmailPreferenceController],
  exports: [EmailPreferenceService]
})
export class EmailPreferenceModule { }
