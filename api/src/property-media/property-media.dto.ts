import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreatePropertyMediaControllerDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The file to be uploaded',
    example: 'example.pdf',
  })
  file: Express.Multer.File;

  @ApiPropertyOptional({ nullable: true })
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsNotEmpty()
  description: string;

  @ApiProperty({ nullable: false, example: 1 })
  @IsNotEmpty()
  eventId: number;
}

export class CreatePropertyMediaDto {
  @ApiPropertyOptional({ nullable: true })
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string;

  @ApiPropertyOptional({ nullable: true })
  url: string;

  @ApiProperty({ nullable: false, example: 1 })
  eventId: number;

  @ApiProperty({ nullable: false })
  @IsNotEmpty()
  @IsNumber()
  size: number;
}