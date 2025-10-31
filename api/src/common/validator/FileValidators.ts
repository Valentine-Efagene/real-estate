import { FileTypeValidator, HttpStatus, MaxFileSizeValidator, ParseFilePipeBuilder } from '@nestjs/common';
import FileSize from '../../s3-uploader/util/FileSize';
import OptionalFilePipe from './OptionalFilePipe';

export default class FileValidators {
  public static imageValidator = new ParseFilePipeBuilder()
    .addFileTypeValidator({
      fileType: '.(jpg|jpeg|png|svg|webp)',
    })
    .addMaxSizeValidator({
      maxSize: 10 * FileSize.MB,
    })
    .build({
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });

  public static fileValidator = new ParseFilePipeBuilder()
    .addMaxSizeValidator({
      maxSize: 100 * FileSize.MB,
    })
    .addFileTypeValidator({
      fileType: '.(jpg|jpeg|png|svg|ppt|pptx|doc|docx|pdf|xls|xlsx|csv|webp)',
    })
    .build({
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });

  public static optionalFileValidator = new OptionalFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: 100 * FileSize.MB }),
      new FileTypeValidator({
        fileType: '.(jpg|jpeg|png|svg|ppt|pptx|doc|docx|pdf|xls|xlsx|csv|webp)',
      }),
    ],
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  });

  public static optionalImageValidator = new OptionalFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: 100 * FileSize.MB }),
      new FileTypeValidator({
        fileType: '.(jpg|jpeg|png|svg|webp)',
      }),
    ],
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  });
}
