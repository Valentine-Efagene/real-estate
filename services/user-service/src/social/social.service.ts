import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Social } from '@valentine-efagene/qshelter-common';
import { CreateSocialDto, UpdateSocialDto } from './social.dto';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(Social)
    private readonly socialRepository: Repository<Social>
  ) { }

  async create(createSocialDto: CreateSocialDto): Promise<Social> {
    return this.socialRepository.save(createSocialDto)
  }

  async findAll(): Promise<Social[]> {
    return this.socialRepository.find();
  }

  findOne(id: number): Promise<Social> {
    return this.socialRepository.findOneBy({ id });
  }

  async updateOne(id: number, updateDto: UpdateSocialDto): Promise<Social> {
    const social = await this.socialRepository.findOneBy({ id });

    if (!social) {
      throw new NotFoundException(`${Social.name} with ID ${id} not found`);
    }

    this.socialRepository.merge(social, updateDto);
    return this.socialRepository.save(social);
  }

  async remove(id: number): Promise<void> {
    await this.socialRepository.delete(id);
  }
}
