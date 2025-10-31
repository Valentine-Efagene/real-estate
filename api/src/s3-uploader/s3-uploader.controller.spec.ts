import { Test, TestingModule } from '@nestjs/testing';
import { S3UploaderController } from './s3-uploader.controller';
import { S3UploaderService } from './s3-uploader.service';

describe('S3Controller', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let controller: S3UploaderController;


  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [S3UploaderController],
      providers: [S3UploaderService],
    }).compile();

    controller = app.get<S3UploaderController>(S3UploaderController);
  });

  describe('root', () => {
    it('should return ""', () => {
      //xpect(controller.getPresignedUrl('https://mofidevbucket.s3.amazonaws.com/developer/document/bd7b173e-44ca-4b7e-8cda-a04d19e988ab-20240109T150408270Z..docx')).toBe('Hello World!');
    });
  });
});
