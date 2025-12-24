import {
  Body,
  Controller,
  Delete,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3UploaderService } from './s3-uploader.service';
import { ApiConsumes, ApiCreatedResponse, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BundleDto, FileUploadDto, ImageUploadDto, PresignedPostDto, PresignerDto } from './s3-uploader.dto';
import FolderResolver from '../util/FolderResolver';
import { FileValidators, SwaggerAuth, StandardApiResponse } from '@valentine-efagene/qshelter-common';

@SwaggerAuth()
@Controller()
export class S3UploaderController {
  constructor(private uploadToS3Service: S3UploaderService) { }

  // IMAGE
  // SAVE
  @Post('image')
  @ApiOperation({
    summary: 'Upload an image',
    description: 'The image will be resized before being stored',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDeveloperLogo(
    @UploadedFile(FileValidators.imageValidator)
    file: Express.Multer.File,
    @Body() body: ImageUploadDto,
  ) {
    const uploadedImage = await this.uploadToS3Service.uploadImageToS3(
      file,
      FolderResolver.resolve(body.path),
    );
    return new StandardApiResponse(HttpStatus.CREATED, 'Created', uploadedImage);
  }

  // IMAGE
  // REPLACE
  @Patch(`image/:url`)
  @ApiOperation({
    summary: 'Replace an image',
    description: '',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiParam({
    name: 'url',
    description: 'The URL or key of the image to be deleted',
    example:
      'https://s3.console.aws.amazon.com/s3/object/qshelter-public?region=us-east-1&bucketType=general&prefix=developer/0ce126ed-c6d0-4db0-a195-95905e9ca699-20240105T143812811Z..jpg',
  })
  async replaceImage(
    @UploadedFile(FileValidators.fileValidator)
    file: Express.Multer.File,
    @Param('url') url: string,
    @Body() body: FileUploadDto,
  ) {
    const uploadedFile = await this.uploadToS3Service.uploadImageToS3(
      file,
      FolderResolver.resolve(body.path),
    );
    await this.uploadToS3Service.deleteFromS3(url);
    return new StandardApiResponse(HttpStatus.OK, 'Replaced', uploadedFile);
  }

  // IMAGE
  // DELETE
  @Delete(`image/:url`)
  @ApiParam({
    name: 'url',
    description: 'The URL or key of the file to be deleted',
    example:
      'https://s3.console.aws.amazon.com/s3/object/qshelter-public?region=us-east-1&bucketType=general&prefix=developer/0ce126ed-c6d0-4db0-a195-95905e9ca699-20240105T143812811Z..jpg',
  })
  async deleteDeveloperLogo(@Param('url') url: string) {
    await this.uploadToS3Service.deleteFromS3(url);
    return new StandardApiResponse(HttpStatus.OK, '', null);
  }

  // DOCUMENTS
  // UPLOAD
  @Post('document')
  @ApiOperation({
    summary: 'Upload a file',
    description: 'This is for general file upload',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(FileValidators.fileValidator)
    file: Express.Multer.File,
    @Body() body: FileUploadDto,
  ) {
    const uploadedImage = await this.uploadToS3Service.uploadFileToS3(
      file,
      FolderResolver.resolve(body.path),
    );
    return new StandardApiResponse(HttpStatus.CREATED, '', uploadedImage);
  }

  // DOCUMENTS
  // REPLACE
  @Patch(`document/:url`)
  @ApiOperation({
    summary: 'Replace a resource',
    description: '',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiParam({
    name: 'url',
    description: 'The URL or key of the file to be deleted',
    example:
      'https://s3.console.aws.amazon.com/s3/object/qshelter-public?region=us-east-1&bucketType=general&prefix=developer/0ce126ed-c6d0-4db0-a195-95905e9ca699-20240105T143812811Z..jpg',
  })
  async replaceDocument(
    @UploadedFile(FileValidators.fileValidator)
    file: Express.Multer.File,
    @Body() body: FileUploadDto,
    @Param('url') url: string,
  ) {
    const uploadedFile = await this.uploadToS3Service.uploadFileToS3(
      file,
      FolderResolver.resolve(body.path),
    );
    await this.uploadToS3Service.deleteFromS3(url);
    return new StandardApiResponse(HttpStatus.CREATED, 'Replaced', uploadedFile);
  }

  // DOCUMENT
  // DELETE
  @Delete(`document`)
  @ApiQuery({
    name: 'url',
    description: 'The URL or key of the file to be deleted',
    example:
      'https://s3.console.aws.amazon.com/s3/object/qshelter-public?region=us-east-1&bucketType=general&prefix=developer/0ce126ed-c6d0-4db0-a195-95905e9ca699-20240105T143812811Z..jpg',
  })
  async deleteDocument(
    @Query('url') url: string
  ) {
    await this.uploadToS3Service.deleteFromS3(url);
    return new StandardApiResponse(HttpStatus.OK, 'Deleted', url);
  }

  @Post(`document/presign`)
  @ApiCreatedResponse({
    status: HttpStatus.OK,
    schema: {
      type: 'object',
      properties: {
        statusCode: {
          type: 'string',
          example: HttpStatus.OK
        },
        data: {
          type: 'string',
          example: 'https://qshelter-public.s3.us-east-1.amazonaws.com/developer/logo/68440651-1382-43f0-959f-65167f48da18-20240109T140936012Z..png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA5CQOHGMWRJFV6LFV%2F20240118%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240118T063639Z&X-Amz-Expires=3600&X-Amz-Signature=0d57e3a508f9725084ba76eed50bedf90c03c691f654b425500f45b468c8501f&X-Amz-SignedHeaders=host&x-id=GetObject'
        },
        message: {
          type: 'string',
          example: 'Signed URL obtained'
        }
      }
    },
    description: `Returns a presigned URL for uploads to the property image bucket. TTL is ${process.env.presigned_url_ttl} seconds`,
  })
  async createPresignedUrl(
    @Body() body: PresignerDto) {
    const data = await this.uploadToS3Service.getPresignedUrl(body.url);
    return new StandardApiResponse(HttpStatus.OK, 'Signed URL obtained', data);
  }

  @Post(`document/create-presigned-post`)
  @ApiCreatedResponse({
    status: HttpStatus.OK,
    schema: {
      type: 'object',
      properties: {
        statusCode: {
          type: 'string',
          example: HttpStatus.OK
        },
        data: {
          type: 'string',
          example: ''
        },
        message: {
          type: 'string',
          example: 'Signed post obtained'
        }
      }
    },
    description: `Returns a presigned URL to the provided resource. TTL is ${process.env.presigned_url_ttl} seconds`,
  })
  async createPresignedPost(
    @Body() dto: PresignedPostDto,
  ) {
    // const folder = 'property_images/'
    const path = dto.key;
    const data = await this.uploadToS3Service.createPresignedPost(path);
    return new StandardApiResponse(HttpStatus.OK, 'Signed URL obtained', data);
  }

  @Post('document/bundle')
  async bundleFiles(
    @Body() dto: BundleDto
  ) {
    const data = await this.uploadToS3Service.bundle(dto.archiveKey, dto.objectUrls);
    return new StandardApiResponse(HttpStatus.OK, 'Bundled', data);
  }
}
