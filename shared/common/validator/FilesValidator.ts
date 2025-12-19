import {
    Injectable,
    PipeTransform,
    ArgumentMetadata,
    BadRequestException,
} from '@nestjs/common';

const MAX_FILE_SIZE_IN_MB: number = 40

@Injectable()
export default class FilesValidator implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        const files: Express.Multer.File[] = value;

        if (!files || files.length === 0) {
            // throw new BadRequestException('No files uploaded');
            return []
        }

        // Example: Validate each file's MIME type and size
        for (const file of files) {
            if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
                throw new BadRequestException(
                    `Unsupported file type ${file.mimetype}`,
                );
            }

            if (file.size > MAX_FILE_SIZE_IN_MB * 1024 * 1024) {
                // Max file size: 2MB
                throw new BadRequestException(`File size exceeds the limit of ${MAX_FILE_SIZE_IN_MB}MB`);
            }
        }

        return files;
    }
}
