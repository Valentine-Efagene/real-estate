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
import { Property } from './property.entity';
import { PropertyService } from './property.service';
import { CreatePropertyControllerDto, SetDisplayImageDto } from './property.dto';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse, ResponseMessage, SwaggerAuth } from '@valentine-efagene/qshelter-common';
import { S3UploaderService } from '../s3-uploader/s3-uploader.service';

@SwaggerAuth()
@Controller('properties')
@ApiTags('Property')
export class PropertyController {
  constructor(
    private readonly propertyService: PropertyService,
    private readonly uploaderService: S3UploaderService,
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
  async findAllPaginated(
    @Paginate() query: PaginateQuery,
    @Query('location') location?: string,
  ): Promise<StandardApiResponse<Paginated<Property>>> {
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
    const { gallery } = createPropertyDto;
    const galleryPromises = []

    for (let index = 0; index < gallery.length; index++) {
      const file = gallery[index];

      const response = await this.uploaderService.uploadFileToS3(
        file,
        S3Folder.DOCUMENT,
      );

      galleryPromises.push(response)
    }

    const urls = await Promise.all(galleryPromises)

    const galleryArray: CreateDocumentDto[] = urls.map((url, index) => {
      return {
        url,
        size: gallery[index].size,
        name: gallery[index].name,
        description: gallery[index].description,
      }
    })

    const data = await this.propertyService.create({ ...createPropertyDto, gallery: galleryArray });
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @SwaggerAuth()
  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Property>> {
    const data = await this.propertyService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  @SwaggerAuth()
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
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
