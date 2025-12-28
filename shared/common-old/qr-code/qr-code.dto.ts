import { ApiProperty } from '@nestjs/swagger';

export class GenerateQrCodeDto {
    @ApiProperty({ nullable: true, example: 'property-123' })
    identifier: string
}
