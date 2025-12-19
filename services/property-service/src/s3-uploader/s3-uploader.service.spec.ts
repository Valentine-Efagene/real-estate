import { ConfigModule } from '@nestjs/config';
// https://stackoverflow.com/a/71045457/6132438
// Moved here to fix a bug (env not being loaded early enough)
const envModule = ConfigModule.forRoot({
    envFilePath: '.env',
    isGlobal: true,
});
import { Test, TestingModule } from '@nestjs/testing';
import { S3UploaderService } from './s3-uploader.service';

describe('CommonService', () => {
    let service: S3UploaderService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [envModule],
            providers: [S3UploaderService],
        }).compile();

        service = module.get<S3UploaderService>(S3UploaderService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should be defined', () => {
        expect(service.getPresignedUrl('https://mofidevbucket.s3.amazonaws.com/developer/document/bd7b173e-44ca-4b7e-8cda-a04d19e988ab-20240109T150408270Z..docx')).toBe('dfsdf');
    });
});
