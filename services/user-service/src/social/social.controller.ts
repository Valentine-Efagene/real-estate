import {
  Controller,
  Delete,
  Get,
  Param,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '../common/common.dto';
import OpenApiHelper from '../common/OpenApiHelper';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth } from '../common/guard/swagger-auth.guard';
import { Social } from './social.entity';

@SwaggerAuth()
@Controller('properties')
@ApiTags('Social')
@ApiResponse(OpenApiHelper.responseDoc)
export class SocialController {
  constructor(
    private readonly SocialService: SocialService,
  ) { }

  @SwaggerAuth()
  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Social>> {
    const data = await this.SocialService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  @SwaggerAuth()
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.SocialService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  @SwaggerAuth()
  @Get()
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  //@RequirePermission(PermissionsEnum.CAN_LIST_USERS)
  async findAll(): Promise<StandardApiResponse<Social[]>> {
    const data = await this.SocialService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }
}
