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
import { PropertyDocumentService } from './property-document.service';
import {
  StandardApiResponse,
  UpdateDocumentStatusDto,
  ResponseMessage,
  SwaggerAuth,
  PropertyDocument,
} from '@valentine-efagene/qshelter-common';
import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePropertyDocumentControllerDto } from './property-document.dto';

@SwaggerAuth()
@Controller('property-document')
@ApiTags('Property Documents')
export class PropertyDocumentController {
  constructor(
    private readonly propertyDocumentService: PropertyDocumentService,
  ) { }

  @Post()
  @ApiOperation({
    summary: 'Create document record with S3 URL',
    description: 'After uploading to S3 using presigned URL, create the document record',
  })
  async create(
    @Body() createPropertyDocumentDto: CreatePropertyDocumentControllerDto,
  ): Promise<StandardApiResponse<PropertyDocument>> {
    const document = await this.propertyDocumentService.create(createPropertyDocumentDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, document);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all documents',
  })
  async findAll(): Promise<StandardApiResponse<PropertyDocument[]>> {
    return new StandardApiResponse(
      HttpStatus.OK,
      ResponseMessage.FETCHED,
      await this.propertyDocumentService.findAll(),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single document by ID',
  })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<PropertyDocument>> {
    return new StandardApiResponse(
      HttpStatus.OK,
      ResponseMessage.FETCHED,
      await this.propertyDocumentService.findOne(id),
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a document',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StandardApiResponse<any>> {
    await this.propertyDocumentService.remove(id);
    return new StandardApiResponse(
      HttpStatus.OK,
      ResponseMessage.DELETED,
      null,
    );
  }

  @Post(':id/status')
  @ApiOperation({
    summary: 'Update document status',
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentStatusDto,
  ): Promise<StandardApiResponse<PropertyDocument>> {
    return new StandardApiResponse(
      HttpStatus.OK,
      ResponseMessage.UPDATED,
      await this.propertyDocumentService.updateStatus(id, dto),
    );
  }
}
