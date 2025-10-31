import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpStatus,
  ParseIntPipe,
  Query,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { Property } from './property.entity';
import { PropertyService } from './property.service';
import { CreatePropertyControllerDto, GalleryItemDto } from './property.dto';
import { ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from 'src/common/common.dto';
import OpenApiHelper from 'src/common/OpenApiHelper';
import { ResponseMessage, S3Folder } from 'src/common/common.enum';
import { SwaggerAuth } from 'src/common/guard/swagger-auth.guard';
import { Paginate, PaginateQuery, Paginated } from 'nestjs-paginate';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3UploaderService } from 'src/s3-uploader/s3-uploader.service';
import { PropertyMediaService } from 'src/property-media/property-media.service';
import FilesValidator from 'src/common/validator/FilesValidator';

@SwaggerAuth()
@Controller('properties')
@ApiTags('Property')
@ApiResponse(OpenApiHelper.responseDoc)
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
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAllPaginated(
    @Paginate() query: PaginateQuery,
    @Query('location') location?: string,
  ): Promise<StandardApiResponse<Paginated<Property>>> {
    const data = await this.propertyService.findAllPaginated(query, location);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('gallery', 10))
  async create(
    // @UploadedFiles(FileValidators.fileValidator)
    @UploadedFiles(FilesValidator) gallery: Express.Multer.File[],
    @Body() createPropertyDto: CreatePropertyControllerDto,
  ): Promise<StandardApiResponse<Property>> {
    if (!gallery) {
      throw new BadRequestException();
    }

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

    const galleryArray: GalleryItemDto[] = urls.map((url, index) => {
      return {
        url,
        size: gallery[index].size
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
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  //@RequirePermission(PermissionsEnum.CAN_LIST_USERS)
  async findAll(): Promise<StandardApiResponse<Property[]>> {
    const data = await this.propertyService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }
}
