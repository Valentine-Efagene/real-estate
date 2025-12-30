import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import EmailService from './email.service';
import { SlackModule } from '../slack/slack.module';
import { PushModule } from '../push/push.module';
import { DeviceEndpointModule } from '../device_endpoint/device_endpoint.module';
import { EmailPreferenceModule } from '../email_preference/email_preference.module';
import { Office365Module } from '../office365/office365.module';

@Module({
  imports: [
    SlackModule,
    PushModule,
    DeviceEndpointModule,
    EmailPreferenceModule,
    Office365Module,
  ],
  controllers: [EmailController],
  providers: [
    EmailService,
  ],
  exports: [EmailService]
})
export class EmailModule { }