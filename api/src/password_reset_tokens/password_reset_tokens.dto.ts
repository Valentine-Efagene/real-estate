import { ApiProperty } from '@nestjs/swagger';

export class CreatePasswordResetTokenDto {
  @ApiProperty({
    nullable: true,
    example: 1
  })
  userId: number;

  @ApiProperty({
    nullable: true,
    example: 'johnnyufuoma@test.com'
  })
  email: string

  @ApiProperty({
    nullable: true,
    example: 'iouchwiuecbwubiu3iu3i2u32u9se8u9c'
  })
  token: string

  @ApiProperty({
    nullable: true,
    example: '2024-07-12 08:05:16',
    format: 'date-time',
  })
  expiresAt: string
}