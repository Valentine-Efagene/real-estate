import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Currency, Period, PropertyCategory, PropertyType } from './social.enums';
import { Transform, Type } from 'class-transformer';

export class CreateSocialDto {
  @ApiProperty({
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  userId: number;

  @ApiProperty({
    example: 'Facebook',
  })
  @IsNotEmpty()
  @MaxLength(255)
  brand: string;

  @ApiProperty({
    example: 'Facebook',
  })
  @IsNotEmpty()
  @MaxLength(255)
  link: string;
}

export class UpdateSocialDto {
  @ApiProperty({
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  userId: number;

  @ApiProperty({
    example: 'Facebook',
  })
  @IsNotEmpty()
  @MaxLength(255)
  brand: string;

  @ApiProperty({
    example: 'Facebook',
  })
  @IsNotEmpty()
  @MaxLength(255)
  link: string;
}