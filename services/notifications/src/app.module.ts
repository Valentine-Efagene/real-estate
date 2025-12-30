import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailModule } from './email/email.module';
import { SmsModule } from './sms/sms.module';
import { SlackModule } from './slack/slack.module';
import { PushModule } from './push/push.module';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEndpoint } from '../../../shared/common/entities/device_endpoint.entity';
import { User } from '@valentine-efagene/qshelter-common';
import { CustomNamingStrategy } from './common/helpers/CustomNamingStrategy';
import { DeviceEndpointModule } from './device_endpoint/device_endpoint.module';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { EmailPreference } from '../../../shared/common/entities/email_preference.entity';
import { EmailPreferenceModule } from './email_preference/email_preference.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { Office365Module } from './office365/office365.module';
import { AccessLoggerMiddleware } from './common/middleware/AccessLoggerMiddleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        domain: Joi.string(),
        basePath: Joi.string()
      })
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT) ?? 3306,
      username: process.env.DB_USERNAME ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME,
      entities: [
        // Don't add intermediate tables, or it will throw an error about only one key
        DeviceEndpoint,
        User,
        EmailPreference
      ],
      synchronize: process.env.DB_HOST === 'localhost',
      namingStrategy: new CustomNamingStrategy(),
    }),
    EmailModule,
    SmsModule,
    SlackModule,
    PushModule,
    UserModule,
    DeviceEndpointModule,
    EmailPreferenceModule,
    WhatsappModule,
    Office365Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AccessLoggerMiddleware)
      .forRoutes('*');
  }
}
