import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsString, IsNumberString } from 'class-validator';
import { DocumentStatus } from './common.type';

export class Document {
  url: string;
  name: string;
  description: string;
}

export class ApproveDocumentDto {
  @ApiProperty({ nullable: false, example: 1 })
  @IsNotEmpty()
  reviewerId: number;
}

export class UpdateDocumentStatusDto {
  @ApiProperty({
    nullable: false,
    enum: DocumentStatus,
    example: DocumentStatus.APPROVED,
  })
  @IsNotEmpty()
  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Required for declines'
  })
  declineReason: string;

  @ApiProperty({ nullable: false, example: 1 })
  @IsNotEmpty()
  reviewerId: number;
}


export class UpdateDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The file to be uploaded',
    example: 'example.pdf',
  })
  file?: Express.Multer.File;

  @ApiPropertyOptional({ nullable: true })
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  url?: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  mimeType?: string;
}

export class DeclineDocumentDto {
  @ApiProperty({ nullable: false })
  @IsNotEmpty()
  @IsString()
  declineReason?: string;

  @ApiProperty({ nullable: false, example: 1 })
  @IsNotEmpty()
  @IsString()
  reviewerId: number;
}

@ApiExtraModels(StandardApiResponse)
export class StandardApiResponse<T = any> {
  statusCode: number;
  message: string;
  payload?: T;

  constructor(statusCode: number, message: string, data?: T) {
    this.message = message;
    this.statusCode = statusCode;
    this.payload = data;
  }
}

export class DocumentReuploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The new file to be uploaded',
    example: 'example.pdf',
  })
  file: Express.Multer.File;

  @ApiProperty({
    nullable: false,
    description: 'ID of the file to replace'
  })
  @IsNotEmpty()
  @IsNumberString()
  id: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional new name for the file'
  })
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional new description for the file'
  })
  description?: string;
}