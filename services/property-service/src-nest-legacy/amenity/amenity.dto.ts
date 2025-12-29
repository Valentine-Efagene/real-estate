import { ApiProperty } from '@nestjs/swagger';

export class CreateAmenityDto {
  @ApiProperty({ nullable: true, example: 'WiFi' })
  name: string;
}