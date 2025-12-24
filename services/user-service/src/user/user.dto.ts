import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
// import { UserRole } from './user.enums';

export class CreateUserDto {
  @ApiProperty({
    example: 'test@tester.com',
  })
  @IsNotEmpty()
  @MaxLength(50)
  email: string;

  @ApiProperty({
    example: 'Pa$Sw0rd',
  })
  @IsNotEmpty()
  @MaxLength(50)
  // @IsStrongPassword()
  password: string;

  @ApiProperty({ nullable: true, example: 'Jane' })
  @IsOptional()
  firstName?: string;

  @ApiProperty({ nullable: true, example: 'Doe' })
  @IsOptional()
  lastName?: string;

  @ApiProperty({ nullable: false, example: 'Canada' })
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    type: 'array',
    description: 'User roles',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}

export class CreateAdminDto {
  @ApiProperty({
    example: 'john@admin.com',
  })
  @IsNotEmpty()
  @MaxLength(50)
  email: string;

  @ApiProperty({
    example: 'Pa$Sw0rd',
  })
  @IsNotEmpty()
  @MaxLength(50)
  // @IsStrongPassword()
  password: string;

  @ApiProperty({ nullable: true, example: 'Jane' })
  @IsOptional()
  firstName?: string;

  @ApiProperty({ nullable: true, example: 'Doe' })
  @IsOptional()
  lastName?: string;

  @ApiProperty({ nullable: false, example: 'Canada' })
  @IsOptional()
  country?: string;
}


export class UpdateUserDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  avatar?: string

  @ApiPropertyOptional({ nullable: true, example: 'Jane' })
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ nullable: true, example: 'Doe' })
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ nullable: true, example: '09034360573' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ nullable: true, example: 'ewoieoiwueowh' })
  @IsOptional()
  emailVerificationToken?: string;

  @ApiPropertyOptional({ nullable: true, example: 'Aliqua laborum non ea aliquip ipsum dolor laborum amet aute sint non cillum dolore. Eu dolore ullamco anim est ullamco ipsum Lorem labore in aliquip proident commodo aute laborum. Reprehenderit proident esse laboris non irure cillum adipisicing ut occaecat deserunt anim. Cillum do nisi Lorem ipsum tempor exercitation irure laboris amet culpa labore. Culpa laborum consequat duis sit laboris do aute aliquip consectetur elit labore pariatur non.' })
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ nullable: true, example: 'Aliqua laborum non ea aliquip ipsum' })
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    type: 'boolean'
  })
  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean
}

export class UpdateUserControllerDto extends UpdateUserDto {
  @ApiPropertyOptional({
    type: 'string',
    description: 'Avatar URL from S3 upload',
    example: 'https://bucket.s3.amazonaws.com/avatars/user-123.jpg',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class UpdateAvatarDto {
  @ApiProperty({
    type: 'string',
    description: 'Avatar URL from S3 upload',
    example: 'https://bucket.s3.amazonaws.com/avatars/user-123.jpg',
  })
  @IsNotEmpty()
  @IsString()
  avatarUrl: string;
}

export class SuspendUserDto {
  @ApiProperty({
    example: 'Unverified email',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason: string
}

export class AssignRolesDto {
  @ApiPropertyOptional({
    nullable: true,
    type: 'number',
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  roleIds?: number[];
}

export class SetRolesDto {
  @ApiPropertyOptional({
    nullable: true,
    type: 'number',
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  roleIds?: number[];
}