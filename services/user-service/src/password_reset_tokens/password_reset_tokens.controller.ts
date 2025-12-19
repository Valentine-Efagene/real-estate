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
import { PasswordResetToken } from './password_reset_tokens.entity';
import { PasswordResetTokenService } from './password_reset_tokens.service';
import { CreatePasswordResetTokenDto } from './password_reset_tokens.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '../common/common.dto';
import OpenApiHelper from '../common/OpenApiHelper';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth } from '../common/guard/swagger-auth.guard';

@SwaggerAuth()
@Controller('password-reset-tokens')
@ApiTags('Password Reset Token')
@ApiResponse(OpenApiHelper.responseDoc)
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
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAll(): Promise<StandardApiResponse<PasswordResetToken[]>> {
    const data = await this.userService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<PasswordResetToken>> {
    const data = await this.userService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  //@PasswordResetTokens([PasswordResetTokenPasswordResetToken.ADMIN])
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.userService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }
}
