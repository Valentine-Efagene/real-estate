import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ nullable: true, example: 'CAN_LIST_PROPERTIES' })
  name: string;
}

export class UpdatePermissionDto {
  @ApiPropertyOptional({ nullable: true })
  @IsNotEmpty()
  @IsString()
  name?: string;
}
