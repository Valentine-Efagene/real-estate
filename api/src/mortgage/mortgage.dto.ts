import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMortgageDto {
    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsNumber()
    propertyId: number;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsNumber()
    borrowerId?: number;

    @ApiPropertyOptional({ example: 100000 })
    @IsOptional()
    principal?: number;

    @ApiPropertyOptional({ example: 20000 })
    @IsOptional()
    downPayment?: number;

    @ApiPropertyOptional({ example: 360 })
    @IsOptional()
    termMonths?: number;

    @ApiPropertyOptional({ example: 4.5 })
    @IsOptional()
    interestRate?: number;
}

export class CreateMortgageStepDto {
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
    isOptional?: boolean;
}

export class CreateMortgageDocumentDto {
    @ApiProperty({ example: 'contract.pdf' })
    @IsNotEmpty()
    @IsString()
    fileName: string;

    @ApiProperty({ example: 'https://s3.amazonaws.com/...' })
    @IsNotEmpty()
    @IsString()
    url: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    mimeType?: string;
}
