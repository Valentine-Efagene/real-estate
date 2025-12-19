import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateMortgageDocumentDto {
    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsNumber()
    mortgageId: number;

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

export class UpdateMortgageDocumentDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    fileName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    url?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    mimeType?: string;
}
