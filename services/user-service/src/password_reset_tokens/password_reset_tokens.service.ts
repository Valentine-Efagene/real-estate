import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordResetToken } from './password_reset_tokens.entity';
import { CreatePasswordResetTokenDto } from './password_reset_tokens.dto';

@Injectable()
export class PasswordResetTokenService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) { }

  async create(createPasswordResetTokenDto: CreatePasswordResetTokenDto): Promise<PasswordResetToken> {
    const entity = this.passwordResetTokenRepository.create(createPasswordResetTokenDto);
    return await this.passwordResetTokenRepository.save(entity);
  }

  async findAll(): Promise<PasswordResetToken[]> {
    return this.passwordResetTokenRepository.find();
  }

  findOne(id: number): Promise<PasswordResetToken> {
    return this.passwordResetTokenRepository.findOneBy({ id });
  }

  async remove(id: number): Promise<void> {
    await this.passwordResetTokenRepository.delete(id);
  }
}
