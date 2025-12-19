import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ nullable: true, example: 'ADMIN' })
  name: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ nullable: true })
  @IsNotEmpty()
  @IsString()
  name?: string;
}

export class AssignPermissionsDto {
  @ApiPropertyOptional({
    nullable: true,
    type: 'number',
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  permissionIds?: number[];
}
