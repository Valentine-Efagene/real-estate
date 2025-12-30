import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEndpoint } from '@valentine-efagene/qshelter-common';
import { CreateDeviceEndpointDto, UpdateDeviceEndpointDto } from './device_endpoint.dto';

@Injectable()
export class DeviceEndpointService {
  constructor(
    @InjectRepository(DeviceEndpoint)
    private readonly deviceEndpointRepository: Repository<DeviceEndpoint>,
  ) { }

  async create(createDeviceEndpointDto: CreateDeviceEndpointDto): Promise<DeviceEndpoint> {
    const entity = this.deviceEndpointRepository.create(createDeviceEndpointDto);
    return await this.deviceEndpointRepository.save(entity);
  }

  findOne(id: number): Promise<DeviceEndpoint> {
    return this.deviceEndpointRepository.findOne({
      where: { id },
    });
  }

  findOneByEmail(email: string): Promise<DeviceEndpoint> {
    return this.deviceEndpointRepository.findOne({
      where: { userData: email },
    });
  }

  async updateOne(id: number, updateDto: UpdateDeviceEndpointDto): Promise<DeviceEndpoint> {
    const deviceEndpoint = await this.deviceEndpointRepository.findOneBy({ id });

    if (!deviceEndpoint) {
      throw new NotFoundException(`${DeviceEndpoint.name} with ID ${id} not found`);
    }

    this.deviceEndpointRepository.merge(deviceEndpoint, updateDto);
    return this.deviceEndpointRepository.save(deviceEndpoint);
  }

  async remove(id: number): Promise<void> {
    await this.deviceEndpointRepository.delete(id);
  }
}
