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
import { Amenity } from './amenity.entity';
import { AmenityService } from './amenity.service';
import { CreateAmenityDto } from './amenity.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, StandardApiResponse, SwaggerAuth } from '@valentine-efagene/qshelter-common';

@SwaggerAuth()
@Controller('amenities')
@ApiTags('Amenity')
export class AmenityController {
  constructor(private readonly userService: AmenityService) { }

  @Post()
  async create(
    @Body() createAmenityDto: CreateAmenityDto,
  ): Promise<StandardApiResponse<Amenity>> {
    const data = await this.userService.create(createAmenityDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @Get()
  async findAll(): Promise<StandardApiResponse<Amenity[]>> {
    const data = await this.userService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Amenity>> {
    const data = await this.userService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  //@Amenitys([AmenityAmenity.ADMIN])
  @ApiOperation({ summary: '', tags: ['Admin'] })
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.userService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }
}
