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

// Avatar uploads are handled on the frontend using presigned S3 URLs
// No need for file upload DTOs in the backend