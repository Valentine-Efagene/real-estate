import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';

export class BulkInviteDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The file to be uploaded',
    example: 'example.csv',
  })
  @IsNotEmpty()
  file?: Express.Multer.File;

  @ApiProperty({

  })
  @Transform(({ value }) => {
    return parseInt(value)
  })
  userId: number
}

export class TestDto {
  @ApiProperty({

  })
  data: string
}