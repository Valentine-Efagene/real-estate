import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Currency, Period, PropertyCategory, PropertyType } from './settings.enums';
import { Transform, Type } from 'class-transformer';

export class CreateSettingsBaseDto {
  @ApiProperty({
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  userId: number;

  @ApiProperty({
    example: 'Pine Apartments',
  })
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    example: 'Pine Apartments',
  })
  @IsNotEmpty()
  @MaxLength(255)
  streetAddress: string;

  @ApiProperty({
    example: 'Pine Apartments',
  })
  @IsNotEmpty()
  @MaxLength(255)
  city: string;

  @ApiProperty({
    example: 'Pine Apartments',
  })
  @IsNotEmpty()
  @MaxLength(255)
  zipCode: string;

  @ApiProperty({
    example: 'Pine Apartments',
  })
  @IsNotEmpty()
  @MaxLength(255)
  district: string;

  @ApiProperty({
    example: 'Pine Apartments',
  })
  @IsNotEmpty()
  @MaxLength(255)
  country: string;

  @ApiProperty({
    example: PropertyCategory.SALE,
    type: 'enum',
    enum: PropertyCategory
  })
  @IsNotEmpty()
  category: string

  @ApiProperty({
    example: PropertyType.HOUSE,
    type: 'enum',
    enum: PropertyType
  })
  @IsNotEmpty()
  propertyType: PropertyType

  // @ApiProperty({
  //   example: RentPeriodType.YEARLY,
  //   type: 'enum',
  //   enum: RentPeriodType
  // })
  // @IsNotEmpty()
  // rentPeriodType: RentPeriodType

  @ApiProperty({ nullable: true, example: 'Jane' })
  @IsOptional()
  firstName?: string;

  @ApiProperty({ nullable: true, example: 'Doe' })
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    nullable: true, example: '3'
  })
  nBedrooms?: string;

  @ApiProperty({ nullable: true, example: '3' })
  nBathrooms?: string;

  @ApiProperty({ nullable: true, example: '3' })
  nParkingSpots?: string;

  @ApiProperty({ nullable: true, example: '12000000' })
  @IsNumber()
  @Type(() => Number)
  price?: number;

  @ApiProperty({ nullable: true, example: '12000000' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  area?: number;

  @ApiProperty({ nullable: true, example: 60 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @ApiProperty({ nullable: true, example: 50 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiProperty({ nullable: true, example: Currency.NGN, type: 'enum', enum: Currency })
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ nullable: true, example: Period.YEARLY, type: 'enum', enum: Period })
  @IsEnum(Period)
  period?: Period;

  @ApiProperty({
    nullable: true,
    name: 'Description',
    example: 'Example description'
  })
  @IsString()
  @IsOptional()
  description: string

  @ApiPropertyOptional({
    nullable: true,
    type: 'string',
    example: ['WiFi', 'Garage', 'Gym'],
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value
  )
  amenities?: string[];
}

export class CreateSettingsControllerDto extends CreateSettingsBaseDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The file to be uploaded',
    example: 'example.pdf',
  })
  gallery: Express.Multer.File[];
}

export class GalleryItemDto {
  @IsNumber()
  @IsPositive()
  size: number;

  @IsString()
  @IsUrl()
  url: string;
}

export class CreatePropertyDto extends CreateSettingsBaseDto {
  @ApiProperty({
    type: 'array',
    description: 'The gallery urls',
    example: ['', ''],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => GalleryItemDto)
  gallery: GalleryItemDto[];
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
}