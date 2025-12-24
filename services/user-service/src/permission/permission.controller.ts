import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpStatus,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './permission.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerAuth } from '@qshelter/nest-auth';
import { Permission } from '@valentine-efagene/qshelter-common';
import { ResponseMessage, StandardApiResponse } from '../type';

@SwaggerAuth()
@Controller('permissions')
@ApiTags('Permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) { }

  @Post()
  async create(
    @Body() createPermissionDto: CreatePermissionDto,
  ): Promise<StandardApiResponse<Permission>> {
    const data = await this.permissionService.create(createPermissionDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @Post('/seed')
  @HttpCode(HttpStatus.OK)
  async seed() {
    const response = await this.permissionService.seed()
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, response)
  }

  @Get()
  async findAll(): Promise<StandardApiResponse<Permission[]>> {
    const data = await this.permissionService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }


  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Permission>> {
    const data = await this.permissionService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  //@Permissions([PermissionPermission.ADMIN])
  @ApiOperation({ summary: '', tags: ['Admin'] })
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.permissionService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }
}
