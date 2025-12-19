import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Amenity } from './amenity.entity';
import { CreateAmenityDto } from './amenity.dto';

@Injectable()
export class AmenityService {
  constructor(
    @InjectRepository(Amenity)
    private readonly amenityRepository: Repository<Amenity>,
  ) { }

  async create(createAmenityDto: CreateAmenityDto): Promise<Amenity> {
    const entity = this.amenityRepository.create(createAmenityDto);
    return await this.amenityRepository.save(entity);
  }

  async findAll(): Promise<Amenity[]> {
    return this.amenityRepository.find();
  }

  findOne(id: number): Promise<Amenity> {
    return this.amenityRepository.findOneBy({ id });
  }

  async remove(id: number): Promise<void> {
    await this.amenityRepository.delete(id);
  }
}
