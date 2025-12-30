import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateEmailPreferenceDto {
  @ApiProperty({
    example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
  })
  @IsString()
  email: string;
}

export class UpdateEmailPreferenceDto {
  @ApiPropertyOptional({
    example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
  })
  @IsOptional()
  @IsString()
  email: string;

  @ApiPropertyOptional({
    example: 'eFThnIAGbEDjQ5YIcKu-6z:APA91bFC0zN-mARqqftj5tkGMXPX9PrmuUnq3Im12pP0035zKU8BTGhLQP74tlu6JMAGQntgKobUORMOcvfKNcd82jYBUMBrsYnHcPiwfVUX8HwV-srd9a0'
  })
  @IsOptional()
  @IsString()
  unsubscribeToken: string;
}

export class SubscribeDto {
  @ApiPropertyOptional({
    example: 'efagenevalentine@gmail.com',
  })
  @IsNotEmpty()
  @IsString()
  email: string;
}

export class UnSubscribeDto {
  @ApiPropertyOptional({
    description: 'Unsubscribe token',
    example: 'eFThnIAGbEDjQ5YIcKu-6z:APA91bFC0zN-mARqqftj5tkGMXPX9PrmuUnq3Im12pP0035zKU8BTGhLQP74tlu6JMAGQntgKobUORMOcvfKNcd82jYBUMBrsYnHcPiwfVUX8HwV-srd9a0'
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class EmailPreferenceQueryDto {
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