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
import { PropertyMedia } from '@valentine-efagene/qshelter-common';
import { PropertyMediaService } from './property-media.service';
import {
  StandardApiResponse,
  UpdateDocumentStatusDto,
  ResponseMessage,
  SwaggerAuth,
} from '@valentine-efagene/qshelter-common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePropertyMediaControllerDto } from './property-media.dto';

@SwaggerAuth()
@Controller('property-media')
@ApiTags('Property Media (Videos and Images)')
export class PropertyMediaController {
  constructor(
    private readonly PropertyMediaService: PropertyMediaService,
  ) { }

  // TODO: File uploads are handled on frontend with presigned S3 URLs
  // Frontend should generate presigned URLs and upload directly to S3
  // Then POST the S3 URL to create media record

  @Post()
  @ApiOperation({
    summary: 'Create media record with S3 URL',
    description: 'After uploading to S3 using presigned URL, create the media record',
  })
  async create(
    @Body() createPropertyMediaDto: CreatePropertyMediaControllerDto,
  ): Promise<StandardApiResponse<PropertyMedia>> {
    const media = await this.PropertyMediaService.create(createPropertyMediaDto);
    return new StandardApiResponse(
      HttpStatus.CREATED,
      ResponseMessage.CREATED,
      media,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all media',
  })
  async findAll(): Promise<StandardApiResponse<PropertyMedia[]>> {
    return new StandardApiResponse(
      HttpStatus.OK,
      ResponseMessage.FETCHED,
      await this.PropertyMediaService.findAll(),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single media by ID',
  })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<PropertyMedia>> {
    return new StandardApiResponse(
      HttpStatus.OK,
      ResponseMessage.FETCHED,
      await this.PropertyMediaService.findOne(id),
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a media',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StandardApiResponse<any>> {
    await this.PropertyMediaService.remove(id);
    return new StandardApiResponse(
      HttpStatus.OK,
      ResponseMessage.DELETED,
      null,
    );
  }

  @Post(':id/status')
  @ApiOperation({
    summary: 'Update media status',
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentStatusDto,
  ): Promise<StandardApiResponse<PropertyMedia>> {
    return new StandardApiResponse(
      HttpStatus.OK,
      ResponseMessage.UPDATED,
      await this.PropertyMediaService.updateStatus(id, dto),
    );
  }
}
