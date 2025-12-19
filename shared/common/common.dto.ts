import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsString, IsNumberString, IsUrl, IsOptional, IsNumber } from 'class-validator';
import { DocumentStatus } from './common.type';
import { Transform } from 'class-transformer';

export class Document {
  url: string;
  name: string;
  description: string;
}

export class CreateDocumentDto {
  @ApiPropertyOptional({ nullable: true, example: 'Bank Statement' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ nullable: false, example: 'https://example.com/document.pdf' })
  @Transform(({ value }) => encodeURI(value))
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ nullable: true })
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  @IsOptional()
  @IsNumber()
  size?: number;
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
  comment: string;

  @ApiProperty({ nullable: false, example: 1 })
  @IsNotEmpty()
  reviewerId: number;
}

export class UpdateDocumentDto {
  @ApiProperty({
    nullable: false,
    description: 'Size of the file in bytes'
  })
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  @IsOptional()
  @IsNumber()
  size: number;

  @ApiPropertyOptional({ nullable: true })
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  url?: string;
}

export class DeclineDocumentDto {
  @ApiProperty({ nullable: false })
  @IsNotEmpty()
  @IsString()
  comment?: string;

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

  @ApiProperty({
    nullable: false,
    description: 'Size of the file in bytes'
  })
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  @IsOptional()
  @IsNumber()
  size: number;
}