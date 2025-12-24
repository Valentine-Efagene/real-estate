import {
  Controller,
  Delete,
  Get,
  Param,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerAuth } from '@qshelter/nest-auth';
import { Social } from '@valentine-efagene/qshelter-common';
import { ResponseMessage, StandardApiResponse } from '../type';

@SwaggerAuth()
@Controller('properties')
@ApiTags('Social')
export class SocialController {
  constructor(
    private readonly SocialService: SocialService,
  ) { }

  @SwaggerAuth()
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Social>> {
    const data = await this.SocialService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  @SwaggerAuth()
  @ApiOperation({ summary: '', tags: ['Admin'] })
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.SocialService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  @SwaggerAuth()
  @Get()
  async findAll(): Promise<StandardApiResponse<Social[]>> {
    const data = await this.SocialService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }
}
