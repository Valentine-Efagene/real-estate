import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { CreateDocumentDto } from '@valentine-efagene/qshelter-common';

export class CreatePropertyDocumentControllerDto extends CreateDocumentDto {
  @ApiProperty({ nullable: false, example: 1 })
  @IsNotEmpty()
  propertyId: number;
}

export class CreatePropertyDocumentDto extends CreateDocumentDto {
  @ApiProperty({ nullable: false, example: 1 })
  propertyId: number;
}