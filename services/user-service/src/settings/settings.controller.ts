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
import { Settings } from './settings.entity';
import { SettingsService } from './settings.service';
import { CreateSettingsControllerDto, GalleryItemDto } from './settings.dto';
import { ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '../common/common.dto';
import OpenApiHelper from '../common/OpenApiHelper';
import { ResponseMessage, S3Folder } from '../common/common.enum';
import { SwaggerAuth } from '../common/guard/swagger-auth.guard';
import { Paginate, PaginateQuery, Paginated } from 'nestjs-paginate';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3UploaderService } from '../s3-uploader/s3-uploader.service';
import FilesValidator from '../common/validator/FilesValidator';

@SwaggerAuth()
@Controller('properties')
@ApiTags('Settings')
@ApiResponse(OpenApiHelper.responseDoc)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly uploaderService: S3UploaderService,
    // private readonly settingsMediaService: SettingsMediaService
  ) { }

  @Get('paginate')
  @ApiQuery({
    name: 'title',
    type: 'string',
    example: '',
    required: false,
    description: 'The title of the settings'
  })
  @ApiQuery({
    name: 'search',
    type: 'string',
    example: '',
    description: 'Can search by multiple fields: email of poster, title of settings, first name of poster, last name of poster',
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
    name: 'settingsType',
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
  ): Promise<StandardApiResponse<Paginated<Settings>>> {
    const data = await this.settingsService.findAllPaginated(query, location);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('gallery', 10))
  async create(
    // @UploadedFiles(FileValidators.fileValidator)
    @UploadedFiles(FilesValidator) gallery: Express.Multer.File[],
    @Body() createSettingsDto: CreateSettingsControllerDto,
  ): Promise<StandardApiResponse<Settings>> {
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

    const data = await this.settingsService.create({ ...createSettingsDto, gallery: galleryArray });
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @SwaggerAuth()
  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Settings>> {
    const data = await this.settingsService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  @SwaggerAuth()
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.settingsService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  @SwaggerAuth()
  @Get()
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  //@RequirePermission(PermissionsEnum.CAN_LIST_USERS)
  async findAll(): Promise<StandardApiResponse<Settings[]>> {
    const data = await this.settingsService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }
}
