import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

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