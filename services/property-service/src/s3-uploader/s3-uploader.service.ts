import { Injectable, Logger } from '@nestjs/common';
import { Readable, PassThrough } from 'node:stream'
import ImageUtil from '../util/ImageUtil';
import UrlUtil from '../util/UrlUtil';
import { ByteLogger } from './util/ByteLogger';
import archiver from 'archiver';
import AwsUtil from './util/AwsUtil';

@Injectable()
export class S3UploaderService {
  private readonly logger = new Logger(S3UploaderService.name);

  async uploadFileToS3(file: any, folder: string) {
    const path = await AwsUtil.uploadFileToS3(
      file,
      folder,
      ImageUtil.customFilename(file),
      file.mimetype,
    );
    return path;
  }

  async uploadImageToS3(file: any, folder: string) {
    const path = await AwsUtil.uploadImageToS3(
      file,
      folder,
      ImageUtil.customFilename(file),
      file.mimetype,
    );
    return path;
  }

  async replaceFileOnS3(file: any, folder: string, url: string) {
    const path = await AwsUtil.uploadFileToS3(
      file,
      folder,
      ImageUtil.customFilename(file),
      file.mimetype,
    );

    await this.deleteFromS3(url);

    return path;
  }

  async deleteFromS3(url: string) {
    const key = UrlUtil.getKey(url);
    await AwsUtil.deleteFromS3(key);
  }

  async getPresignedUrl(url: string) {
    const key = UrlUtil.getKey(url);
    return await AwsUtil.createPresignedUrl(key);
  }

  async createPresignedPost(key: string) {
    return await AwsUtil.createPresignedPost(key);
  }


  async bundle(archiveKey: string, objectUrls: string[]): Promise<string> {
    const FORMAT = 'zip'
    const archiveStream = archiver(FORMAT)

    archiveStream.on('error', (error: any) => {
      this.logger.error('Archival encountered an error:', error)
      throw new Error(error)
    })

    const passthrough = new PassThrough()
    const byteLogger = new ByteLogger();
    archiveStream
      .pipe(byteLogger)
      .pipe(passthrough)

    const objectKeys = objectUrls.map(url => AwsUtil.getKeyFromUrl(url))
    const responses = await Promise.allSettled(objectKeys.map((key) => AwsUtil.getObject(key)))

    // Filter out failed responses
    responses.forEach((result, index) => {
      if (result.status === "fulfilled") {
        archiveStream.append(result.value.Body as Readable, {
          name: objectKeys[index].split('/').at(-1)
        })
      } else {
        this.logger.warn(`Failed to fetch object: ${objectKeys[index]}`, result.reason)
      }
    })

    const key = `${archiveKey}.${FORMAT}`
    // const key = await AwsUtil.buildKey(`${archiveKey}.${FORMAT}`)

    /**
     * The order of these calls matter
     * You need to initialize the promise for the upload first,
     * so it's open for passthrough, wait for the archive to finalize, 
     * then await the upload promise, else the process gets stuck for 
     * large files
     */

    const uploadPromise = AwsUtil.uploadStream(key, passthrough, "application/zip")
    await archiveStream.finalize()
    await uploadPromise
    const presignedUrl = await AwsUtil.createPresignedUrlFromKey(key)
    return presignedUrl
  }
}
