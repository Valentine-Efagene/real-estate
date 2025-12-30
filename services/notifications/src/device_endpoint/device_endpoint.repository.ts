import { Repository } from 'typeorm';
import { DeviceEndpoint } from '../../../../shared/common/entities/device_endpoint.entity';

export class DeviceEndpointRepository extends Repository<DeviceEndpoint> {
  // ...
}
