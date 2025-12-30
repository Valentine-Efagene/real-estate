import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from './user.enums';

export class CreateUserDto {
  @ApiProperty({ nullable: true, example: 'Jane' })
  firstName: string;

  @ApiProperty({ nullable: true, example: 'Doe' })
  lastName: string;

  @ApiProperty({ nullable: true, example: 'Doe' })
  email: string;

  @ApiProperty({ nullable: true, example: ['developer'] })
  roles: Role[];
} //

export class UpdateUserDto {
  @ApiPropertyOptional({ nullable: true })
  id?: number;
}
