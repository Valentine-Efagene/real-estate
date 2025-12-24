import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
  UsePipes,
  ValidationPipe,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { PropertyMedia } from './property-media.entity';
import { PropertyMediaService } from './property-media.service';
import {
  OpenApiHelper,
  DocumentReuploadDto,
  StandardApiResponse,
  UpdateDocumentStatusDto,
  ResponseMessage,
  S3Folder,
  FileValidators,
  SwaggerAuth,
  AbstractBaseMediaEntity
} from '@valentine-efagene/qshelter-common';
import {
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3UploaderService } from '../s3-uploader/s3-uploader.service';
import { CreatePropertyMediaControllerDto } from './property-media.dto';

@SwaggerAuth()
@Controller('property-media')
@ApiTags('Property Media (Videos and Images)')
@ApiHeader(OpenApiHelper.userIdHeader)
@ApiResponse(OpenApiHelper.responseDoc)
export class PropertyMediaController {
  constructor(
    private readonly PropertyMediaService: PropertyMediaService,
    private readonly uploaderService: S3UploaderService,
  ) { }

  @Post()
  @ApiOperation({
    summary: 'Upload an image or a video',
    description: '',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile(FileValidators.fileValidator)
    file: Express.Multer.File,
    @Body() createPropertyMediaDto: CreatePropertyMediaControllerDto,
  ): Promise<StandardApiResponse<PropertyMedia>> {
    if (!file) {
      throw new BadRequestException('File Required');
    }

    const response = await this.uploaderService.uploadFileToS3(
      file,
      S3Folder.DOCUMENT,
    );

    const url = response;
    const data = await this.PropertyMediaService.create({
      ...createPropertyMediaDto,
      url,
      size: file.size
    });

    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @Get()
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAll(): Promise<StandardApiResponse<PropertyMedia[]>> {
    const data = await this.PropertyMediaService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StandardApiResponse<PropertyMedia>> {
    const data = await this.PropertyMediaService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Post(':id/update-status')
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateDocumentStatusDto,
  ): Promise<StandardApiResponse<PropertyMedia>> {
    const data = await this.PropertyMediaService.updateStatus(
      id,
      updateDto,
    );

    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<void>> {
    await this.PropertyMediaService.remove(id);

    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED);
  }
}
