import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class CreateMortgageStepDto {
    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsNumber()
    mortgageId: number;

    @ApiProperty({ example: 'Application' })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsNumber()
    sequence?: number;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    isOptional?: boolean;
}

export class UpdateMortgageStepDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    sequence?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isOptional?: boolean;
}
