import { ApiProperty } from '@nestjs/swagger';

export class CreateUserSuspensionDto {
  @ApiProperty({ nullable: true, example: 1 })
  userId: number;

  @ApiProperty({ nullable: false, example: '' })
  reason: string
}