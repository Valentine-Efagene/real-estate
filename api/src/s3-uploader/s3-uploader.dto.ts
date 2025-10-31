import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';
import FolderResolver from '../util/FolderResolver';

export class FileUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The file to be uploaded',
    example: 'example.pdf',
  })
  //@IsNotEmpty()
  file: Express.Multer.File;

  @ApiProperty({
    description: Object.keys(FolderResolver.folderMap).join(', '),
    example: Object.keys(FolderResolver.folderMap)[0],
    examples: Object.keys(FolderResolver.folderMap),
  })
  @IsNotEmpty()
  path: string;
}

export class DeleteDto {
  @ApiProperty({
    description: Object.keys(FolderResolver.folderMap).join(', '),
    example: Object.keys(FolderResolver.folderMap)[0],
    examples: Object.keys(FolderResolver.folderMap),
  })
  @IsNotEmpty()
  path: string;
}

export class ImageUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'Image with max size of 10MB. The image will be resized before upload',
    example: 'example.jpg',
  })
  // @IsNotEmpty()
  file: Express.Multer.File;

  @ApiProperty({
    description: Object.keys(FolderResolver.folderMap).join(', '),
    example: Object.keys(FolderResolver.folderMap)[0],
    examples: Object.keys(FolderResolver.folderMap),
  })
  @IsNotEmpty()
  path: string;
}

export class PresignerDto {
  @ApiProperty()
  @IsNotEmpty()
  url: string;
}

export class PresignedPostDto {
  @ApiProperty()
  @IsNotEmpty()
  key: string;
}

export class BundleDto {
  @ApiProperty({
    description: Object.keys(FolderResolver.folderMap).join(', '),
    example: 'archive/bundle',
    examples: Object.keys(FolderResolver.folderMap),
  })
  @IsNotEmpty()
  archiveKey: string;

  @ApiProperty({
    type: 'array',
    description: 'Array of object keys to be bundled',
    example: [
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 2.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 3.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 4.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 5.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 6.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 7.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 8.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 9.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/jobs 10.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/art ai.png",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/test_pdf.pdf",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/test_pdf2.pdf",
      "https://qshelter-public.s3.us-east-1.amazonaws.com/test_pdf3.pdf",
    ],
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  objectUrls: string[]
}