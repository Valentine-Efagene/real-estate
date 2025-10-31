import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSuspension } from './user_suspensions.entity';
import { CreateUserSuspensionDto } from './user_suspensions.dto';

@Injectable()
export class UserSuspensionService {
  constructor(
    @InjectRepository(UserSuspension)
    private readonly cartRepository: Repository<UserSuspension>,
  ) { }

  async create(createUserSuspensionDto: CreateUserSuspensionDto): Promise<UserSuspension> {
    const entity = this.cartRepository.create(createUserSuspensionDto);
    return await this.cartRepository.save(entity);
  }

  async findAll(): Promise<UserSuspension[]> {
    return this.cartRepository.find();
  }

  findOne(id: number): Promise<UserSuspension> {
    return this.cartRepository.findOneBy({ id });
  }

  async remove(id: number): Promise<void> {
    await this.cartRepository.delete(id);
  }
}
