import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateMortgageTypeDto {
    @ApiProperty({ example: 'Standard Fixed' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    slug?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ type: 'array', example: [{ title: 'Application', sequence: 1 }] })
    @IsOptional()
    @IsArray()
    defaultSteps?: any[];

    @ApiPropertyOptional({ type: 'array', example: [{ name: 'ID', required: true }] })
    @IsOptional()
    @IsArray()
    requiredDocuments?: any[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    config?: any;
}

export class UpdateMortgageTypeDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    slug?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ type: 'array' })
    @IsOptional()
    @IsArray()
    defaultSteps?: any[];

    @ApiPropertyOptional({ type: 'array' })
    @IsOptional()
    @IsArray()
    requiredDocuments?: any[];

    @ApiPropertyOptional()
    @IsOptional()
    config?: any;
}
