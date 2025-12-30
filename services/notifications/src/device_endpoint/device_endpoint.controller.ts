import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
  Patch,
} from '@nestjs/common';
import { DeviceEndpoint } from '../../../../shared/common/entities/device_endpoint.entity';
import { DeviceEndpointService } from './device_endpoint.service';
import { CreateDeviceEndpointDto, UpdateDeviceEndpointDto } from './device_endpoint.dto';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '../common/common.dto';
import OpenApiHelper from '../common/OpenApiHelper';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth } from '../common/guard/swagger-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@SwaggerAuth()
@Controller('deviceEndpoints')
@ApiTags('DeviceEndpoint')
@ApiResponse(OpenApiHelper.responseDoc)
export class DeviceEndpointController {
  constructor(
    private readonly deviceEndpointService: DeviceEndpointService,
  ) { }

  @SwaggerAuth()
  @Post()
  async create(
    @Body() createDeviceEndpointDto: CreateDeviceEndpointDto,
  ): Promise<StandardApiResponse<DeviceEndpoint>> {
    const data = await this.deviceEndpointService.create(createDeviceEndpointDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @SwaggerAuth()
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update deviceEndpoint',
    description: '',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDeviceEndpoint(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDeviceEndpointDto,
  ): Promise<StandardApiResponse<DeviceEndpoint>> {
    const data = await this.deviceEndpointService.updateOne(id, body);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<DeviceEndpoint>> {
    const data = await this.deviceEndpointService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  @SwaggerAuth()
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.deviceEndpointService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  // @SwaggerAuth()
  // @Get()
  // @ApiResponse(OpenApiHelper.arrayResponseDoc)
  // async findAll(
  //   @Query() query: DeviceEndpointQueryDto,
  // ): Promise<StandardApiResponse<DeviceEndpoint[]>> {
  //   const data = await this.deviceEndpointService.findAll(query);
  //   return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  // }
}
