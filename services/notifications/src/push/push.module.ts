import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebPushController } from './push.controller';
import PushService from './push.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEndpoint } from '../../../../shared/common/entities/device_endpoint.entity';
import { User } from '@valentine-efagene/qshelter-common';

@Module({
  imports: [HttpModule,
    TypeOrmModule.forFeature([User, DeviceEndpoint])
  ],
  controllers: [WebPushController],
  providers: [PushService],
  exports: [PushService]
})

export class PushModule { }
