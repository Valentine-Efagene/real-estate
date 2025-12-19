import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from 'stream';
import { Logger } from '@nestjs/common';
import ImageUtil from './ImageUtil';

// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-presigned-post/

const config = {
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
  region: process.env.CUSTOM_AWS_REGION ?? "us-east-1",
};

export default class AwsUtil {
  private static readonly s3Client = new S3Client(config);
  private static readonly logger = new Logger(AwsUtil.name)
  private static readonly presignedUrlTtl = process.env.PRESIGNED_URL_TTL ? parseInt(process.env.PRESIGNED_URL_TTL) : 3600;

  private static readonly bucketName = process.env.AWS_S3_BUCKET_NAME;

  public static async splitFilePath(filePath: string) {
    // Normalize the file path to handle both Windows and Unix formats
    let normalizedPath = path.normalize(filePath)
    normalizedPath = normalizedPath.replaceAll('\\', '/')

    // Get the file name (last part of the path)
    const fileName = path.basename(normalizedPath);

    // Get the directory path
    const directoryPath = path.dirname(normalizedPath);
    const extension = path.extname(fileName)

    // Split the directory path into an array of folders
    const folderArray = directoryPath.split('/');

    // Reassemble the folder path as a string (optional, if you need it in this format)
    const folderPath = folderArray.join('/');

    return {
      folderArray,
      folderPath,
      fileName,
      extension
    };
  }

  public static async buildKey(filePath: string): Promise<string> {
    const { folderPath, extension } = await this.splitFilePath(filePath)

    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const uniqueFileName = `${uuidv4()}-${timestamp}${extension}`;
    const key = `${folderPath}/${uniqueFileName}`
    return key
  }

  public static async uploadToS3(
    file: any,
    folder: string,
    fileName: string,
    fileType: string,
    transform: (file) => Promise<Buffer>,
  ) {
    const filePath = `${folder}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
      Body: await transform(file),
      ContentType: fileType,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error({ error });
    }

    return `https://${this.bucketName}.s3.amazonaws.com/${filePath}`;
  }

  public static async deleteFromS3(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await this.s3Client.send(command);
  }

  public static async uploadImageToS3(
    file: any,
    folder: string,
    fileName: string,
    fileType: string,
  ) {
    return this.uploadToS3(file, folder, fileName, fileType, (file) =>
      ImageUtil.resizeImage(file),
    );
  }

  public static async uploadFileToS3(
    file: any,
    folder: string,
    fileName: string,
    fileType: string,
  ) {
    return this.uploadToS3(
      file,
      folder,
      fileName,
      fileType,
      async (file) => file,
    );
  }

  public static createPresignedUrl = async (url: string) => {
    const key = this.getKeyFromUrl(url)
    return this.createPresignedUrlFromKey(key)
  }

  public static createPresignedUrlFromKey = async (key: string) => {
    const client = this.s3Client
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });

    return getSignedUrl(client, command,
      {
        expiresIn: this.presignedUrlTtl
      });
  }

  public static getKeyFromUrl = (url: string) => {
    return url.split('amazonaws.com/').at(-1)
  }

  public static async createPresignedPost(key: string) {
    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucketName,
      Key: await this.buildKey(key),
      Expires: this.presignedUrlTtl
    })

    return { url, fields }
  }

  public static async getObject(key: string) {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    const response = await this.s3Client.send(command)
    return response
  }

  public static async uploadStream(key: string, fileStream: PassThrough, contentType: string = "application/octet-stream") {
    try {
      const uploadTask = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: fileStream, // Can be an unknown-length stream
          ContentType: contentType
        },
      });

      uploadTask.on('httpUploadProgress', (progress) => {
        this.logger.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
        this.logger.log(progress)
      });

      await uploadTask.done()
      this.logger.log(`File uploaded successfully to S3: ${this.bucketName}/${key}`);
    } catch (error) {
      this.logger.error('S3 Upload Error:', error);
      throw error;
    }
  }
}
