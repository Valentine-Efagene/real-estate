import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Period, TicketCategory } from './ticket.enums';
import { Transform, Type } from 'class-transformer';

export class CreateTicketDto {
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
  eventTicketTypeId: number;

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
    example: TicketCategory.SALE,
    type: 'enum',
    enum: TicketCategory
  })
  @IsNotEmpty()
  category: TicketCategory

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
}

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
}

export class TicketReassignmentDto {
  @ApiProperty({})
  @IsNotEmpty()
  guestEmail: string

  @ApiProperty({})
  @IsNotEmpty()
  guestFirstName: string

  @ApiProperty({})
  @IsNotEmpty()
  guestLastName: string

  @ApiPropertyOptional({})
  guestPhone?: string
}