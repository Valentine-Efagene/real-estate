import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { PasswordResetTokenService } from './password_reset_tokens.service';
import { CreatePasswordResetTokenDto } from './password_reset_tokens.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PasswordResetToken } from '@valentine-efagene/entities';
import { SwaggerAuth } from '@qshelter/nest-auth';
import { ResponseMessage, StandardApiResponse } from 'src/type';

@SwaggerAuth()
@Controller('password-reset-tokens')
@ApiTags('Password Reset Token')
export class PasswordResetTokenController {
  constructor(private readonly userService: PasswordResetTokenService) { }

  @Post()
  async create(
    @Body() createPasswordResetTokenDto: CreatePasswordResetTokenDto,
  ): Promise<StandardApiResponse<PasswordResetToken>> {
    const data = await this.userService.create(createPasswordResetTokenDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @Get()
  async findAll(): Promise<StandardApiResponse<PasswordResetToken[]>> {
    const data = await this.userService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<PasswordResetToken>> {
    const data = await this.userService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  //@PasswordResetTokens([PasswordResetTokenPasswordResetToken.ADMIN])
  @ApiOperation({ summary: '', tags: ['Admin'] })
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.userService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }
}
