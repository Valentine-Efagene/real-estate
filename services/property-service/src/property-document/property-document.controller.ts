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
import { PropertyDocument } from './property-document.entity';
import { PropertyDocumentService } from './property-document.service';
import { CreatePropertyDocumentControllerDto } from './property-document.dto';
import {
  OpenApiHelper,
  DocumentReuploadDto,
  StandardApiResponse,
  UpdateDocumentStatusDto,
  ResponseMessage,
  S3Folder,
  FileValidators,
  SwaggerAuth,
  AbstractBaseDocumentEntity
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

@SwaggerAuth()
@Controller('property-documents')
@ApiTags('Property Document')
@ApiHeader(OpenApiHelper.userIdHeader)
@ApiResponse(OpenApiHelper.responseDoc)
export class PropertyDocumentController {
  constructor(
    private readonly propertyDocumentService: PropertyDocumentService,
    private readonly uploaderService: S3UploaderService,
  ) { }

  @Post()
  @ApiOperation({
    summary: 'Upload a file',
    description: '',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile(FileValidators.fileValidator)
    file: Express.Multer.File,
    @Body() createPropertyDocumentDto: CreatePropertyDocumentControllerDto,
  ): Promise<StandardApiResponse<PropertyDocument>> {
    if (!file) {
      throw new BadRequestException('File Required');
    }

    const response = await this.uploaderService.uploadFileToS3(
      file,
      S3Folder.DOCUMENT,
    );

    const url = response;
    const data = await this.propertyDocumentService.create({
      ...createPropertyDocumentDto,
      url,
      size: file.size
    });

    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @Get()
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAll(): Promise<StandardApiResponse<PropertyDocument[]>> {
    const data = await this.propertyDocumentService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StandardApiResponse<PropertyDocument>> {
    const data = await this.propertyDocumentService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Post(':id/update-status')
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateDocumentStatusDto,
  ): Promise<StandardApiResponse<PropertyDocument>> {
    const data = await this.propertyDocumentService.updateStatus(
      id,
      updateDto,
    );

    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<void>> {
    await this.propertyDocumentService.remove(id);

    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  @Post('reupload')
  @ApiOperation({
    summary: 'Reupload a file',
    description: ``,
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async reupload(
    @UploadedFile(FileValidators.imageValidator)
    file: Express.Multer.File,
    @Body() body: DocumentReuploadDto,
  ): Promise<StandardApiResponse<AbstractBaseDocumentEntity>> {
    if (!file) {
      throw new BadRequestException();
    }

    const res = await this.propertyDocumentService.reupload(file, body)
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, res);
  }
}
