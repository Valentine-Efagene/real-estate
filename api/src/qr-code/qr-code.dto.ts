import { ApiProperty } from '@nestjs/swagger';

export class GenerateQrCodeDto {
  @ApiProperty({ nullable: true, example: 10000 })
  identifier: string
}