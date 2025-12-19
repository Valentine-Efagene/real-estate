import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsOptional, IsStrongPassword, MaxLength } from 'class-validator';

export class CreateRefreshTokenDto {
  @ApiProperty({
    example: 1,
  })
  @IsNotEmpty()
  userId: number;

  @ApiProperty({
    example: 12345678,
  })
  @IsNotEmpty()
  @IsJWT()
  token: string;
}

export class AvatarUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The file to be uploaded',
    example: 'example.pdf',
  })
  file: Express.Multer.File;
}