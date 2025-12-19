import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh_token.entity';
import { CreateRefreshTokenDto } from './refresh_token.dto';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) { }

  async create(createRefreshTokenDto: CreateRefreshTokenDto): Promise<RefreshToken> {
    const entity = this.refreshTokenRepository.create(createRefreshTokenDto);
    return await this.refreshTokenRepository.save(entity);
  }

  async findAll(): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find();
  }

  findOne(id: number): Promise<RefreshToken> {
    return this.refreshTokenRepository.findOneBy({ id });
  }

  findOneByToken(token: string): Promise<RefreshToken> {
    return this.refreshTokenRepository.findOneBy({ token });
  }

  findOneByUserId(userId: number): Promise<RefreshToken> {
    return this.refreshTokenRepository.findOneBy({ userId });
  }

  async replaceToken(dto: CreateRefreshTokenDto): Promise<RefreshToken> {
    const refreshToken = await this.refreshTokenRepository.findOneBy({ userId: dto.userId });

    if (!refreshToken) {
      throw new NotFoundException(`${RefreshToken.name} not found`);
    }

    this.refreshTokenRepository.merge(refreshToken, { token: dto.token });
    return this.refreshTokenRepository.save(refreshToken);
  }

  async remove(id: number): Promise<void> {
    await this.refreshTokenRepository.delete(id);
  }
}
