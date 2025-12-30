import { Module } from '@nestjs/common';
import { DeviceEndpointController } from './device_endpoint.controller';
import { DeviceEndpointService } from './device_endpoint.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEndpoint } from '../../../../shared/common/entities/device_endpoint.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceEndpoint])],
  providers: [DeviceEndpointService],
  controllers: [DeviceEndpointController],
  exports: [DeviceEndpointService]
})
export class DeviceEndpointModule { }
