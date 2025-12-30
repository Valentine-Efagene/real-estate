import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateDeviceEndpointDto {
  @ApiProperty({
    example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
  })
  @IsString()
  userAgent: string;

  @ApiProperty({
    example: 1,
  })
  @IsNotEmpty()
  userId: number;

  @ApiProperty({
    example: 'arn:aws:sns:us-east-1:898751738669:endpoint/GCM/qshelter_notification/8ad29fff-ab54-370d-b24e-19ff0a715a87'
  })
  @IsString()
  endpointArn: string;

  @ApiProperty({
    example: 'eFThnIAGbEDjQ5YIcKu-6z:APA91bFC0zN-mARqqftj5tkGMXPX9PrmuUnq3Im12pP0035zKU8BTGhLQP74tlu6JMAGQntgKobUORMOcvfKNcd82jYBUMBrsYnHcPiwfVUX8HwV-srd9a0'
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class UpdateDeviceEndpointDto {
  @ApiPropertyOptional({
    example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
  })
  @IsOptional()
  @IsString()
  userAgent: string;

  @ApiPropertyOptional({
    example: 1,
  })
  @IsOptional()
  userId: number;

  @ApiPropertyOptional({
    example: 'arn:aws:sns:us-east-1:898751738669:endpoint/GCM/qshelter_notification/8ad29fff-ab54-370d-b24e-19ff0a715a87'
  })
  @IsOptional()
  @IsString()
  endpointArn: string;

  @ApiPropertyOptional({
    example: 'eFThnIAGbEDjQ5YIcKu-6z:APA91bFC0zN-mARqqftj5tkGMXPX9PrmuUnq3Im12pP0035zKU8BTGhLQP74tlu6JMAGQntgKobUORMOcvfKNcd82jYBUMBrsYnHcPiwfVUX8HwV-srd9a0'
  })
  @IsOptional()
  @IsString()
  token: string;
}

export class DeviceEndpointQueryDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  search?: string

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  message?: string

  @ApiPropertyOptional({
    nullable: true
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => encodeURI(value))
  @IsUrl()
  link?: string

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  limit?: number

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string
}