import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Property } from '@valentine-efagene/qshelter-common';
import { PropertyService } from './property.service';
import { CreatePropertyControllerDto, SetDisplayImageDto } from './property.dto';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse, ResponseMessage, SwaggerAuth, PaginatedResponse, PaginationQuery } from '@valentine-efagene/qshelter-common';

@SwaggerAuth()
@Controller('properties')
@ApiTags('Property')
export class PropertyController {
  constructor(
    private readonly propertyService: PropertyService,
    // private readonly propertyMediaService: PropertyMediaService
  ) { }

  @Get('paginate')
  @ApiQuery({
    name: 'title',
    type: 'string',
    example: '',
    required: false,
    description: 'The title of the property'
  })
  @ApiQuery({
    name: 'search',
    type: 'string',
    example: '',
    description: 'Can search by multiple fields: email of poster, title of property, first name of poster, last name of poster',
    required: false,
  })
  @ApiQuery({
    name: 'category',
    type: 'string',
    example: '',
    description: '',
    required: false,
  })
  @ApiQuery({
    name: 'propertyType',
    type: 'string',
    example: '',
    required: false,
    description: ''
  })
  @ApiQuery({
    name: 'location',
    type: 'string',
    example: '',
    required: false,
    description: 'Will search across all location fields'
  })
  @ApiQuery({
    name: 'price',
    type: 'string',
    example: '',
    required: false,
    description: 'Less than or equal to'
  })
  @ApiQuery({
    name: 'page',
    type: 'number',
    example: 1,
    required: false,
    description: 'Page number'
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    example: 10,
    required: false,
    description: 'Items per page'
  })
  async findAllPaginated(
    @Query() query: PaginationQuery,
    @Query('location') location?: string,
  ): Promise<StandardApiResponse<PaginatedResponse<Property>>> {
    const data = await this.propertyService.findAllPaginated(query, location);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @HttpCode(HttpStatus.OK)
  @Post(':id/set-display-image')
  async setDisplayImage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetDisplayImageDto
  ) {
    const response = await this.propertyService.setDisplayImage(id, dto.propertyMediaId)
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, response)
  }

  @SwaggerAuth()
  @Post()
  async create(
    @Body() createPropertyDto: CreatePropertyControllerDto,
  ): Promise<StandardApiResponse<Property>> {
    const data = await this.propertyService.create(createPropertyDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @SwaggerAuth()
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Property>> {
    const data = await this.propertyService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  @SwaggerAuth()
  @ApiOperation({ summary: '', tags: ['Admin'] })
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.propertyService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  @SwaggerAuth()
  @Get()
  //@RequirePermission(PermissionsEnum.CAN_LIST_USERS)
  async findAll(): Promise<StandardApiResponse<Property[]>> {
    const data = await this.propertyService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }
}
