import {
    S3Client,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost as s3CreatePresignedPost } from '@aws-sdk/s3-presigned-post';
import { Upload } from '@aws-sdk/lib-storage';
import { lookup } from 'mime-types';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';

// =============================================================================
// S3 CLIENT CONFIGURATION
// =============================================================================

const isLocalstack = process.env.NODE_ENV === 'localstack' || process.env.NODE_ENV === 'test';

const s3Config = isLocalstack
    ? {
        endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
        region: 'us-east-1',
        credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
        },
        forcePathStyle: true,
    }
    : {
        region: process.env.AWS_REGION || 'us-east-1',
    };

export const s3Client = new S3Client(s3Config);

const PRESIGNED_URL_TTL = process.env.PRESIGNED_URL_TTL
    ? parseInt(process.env.PRESIGNED_URL_TTL, 10)
    : 3600;

const getBucketName = (): string => {
    const bucket = process.env.S3_BUCKET_NAME || process.env.CUSTOM_AWS_S3_BUCKET_NAME;
    if (!bucket) {
        throw new Error('S3_BUCKET_NAME environment variable is not set');
    }
    return bucket;
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get content type from filename using mime-types
 */
export function getContentType(filename: string): string {
    const contentType = lookup(filename);
    return contentType || 'application/octet-stream';
}

/**
 * Extract S3 key from a full S3 URL
 */
export function getKeyFromUrl(url: string): string {
    // Handle both full URLs and raw keys
    if (url.includes('amazonaws.com/')) {
        return url.split('amazonaws.com/').at(-1) || url;
    }
    if (url.includes('.s3.') && url.includes('/')) {
        // Handle s3://bucket/key or https://bucket.s3.region.amazonaws.com/key
        const parts = url.split('/');
        return parts.slice(3).join('/');
    }
    // Assume it's already a key
    return url;
}

/**
 * Build a unique S3 key with UUID and timestamp
 */
export function buildKey(folder: string, fileName: string): string {
    const ext = path.extname(fileName);
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const uniqueFileName = `${uuid()}-${timestamp}${ext}`;
    return `${folder}/${uniqueFileName}`;
}

// =============================================================================
// S3 OPERATIONS
// =============================================================================

/**
 * Create a presigned POST URL for client-side uploads
 */
export async function createPresignedPost(
    folder: string,
    fileName: string,
    contentType?: string
): Promise<{ url: string; fields: Record<string, string>; key: string; expiresIn: number }> {
    const bucketName = getBucketName();
    const key = buildKey(folder, fileName);
    const mimeType = contentType || getContentType(fileName);

    const { url, fields } = await s3CreatePresignedPost(s3Client, {
        Bucket: bucketName,
        Key: key,
        Fields: {
            'Content-Type': mimeType,
        },
        Expires: PRESIGNED_URL_TTL,
        Conditions: [
            ['eq', '$Content-Type', mimeType],
            ['content-length-range', 0, 100 * 1024 * 1024], // Max 100MB
        ],
    });

    return { url, fields, key, expiresIn: PRESIGNED_URL_TTL };
}

/**
 * Create a presigned GET URL for downloads
 */
export async function createPresignedUrl(
    urlOrKey: string
): Promise<{ presignedUrl: string; expiresIn: number }> {
    const bucketName = getBucketName();
    const key = getKeyFromUrl(urlOrKey);

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGNED_URL_TTL,
    });

    return { presignedUrl, expiresIn: PRESIGNED_URL_TTL };
}

/**
 * Delete an object from S3
 */
export async function deleteFromS3(urlOrKey: string): Promise<void> {
    const bucketName = getBucketName();
    const key = getKeyFromUrl(urlOrKey);

    const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    await s3Client.send(command);
}

/**
 * Get an object from S3
 */
export async function getObject(key: string): Promise<{ Body: Readable; ContentType?: string }> {
    const bucketName = getBucketName();

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
        throw new Error(`Object not found: ${key}`);
    }

    return {
        Body: response.Body as Readable,
        ContentType: response.ContentType,
    };
}

/**
 * Upload a stream to S3 (used for bundling)
 */
export async function uploadStream(
    key: string,
    stream: PassThrough,
    contentType: string = 'application/octet-stream'
): Promise<string> {
    const bucketName = getBucketName();

    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: bucketName,
            Key: key,
            Body: stream,
            ContentType: contentType,
        },
    });

    upload.on('httpUploadProgress', (progress) => {
        console.log(`[S3] Upload progress: ${progress.loaded}/${progress.total} bytes`);
    });

    await upload.done();

    console.log(`[S3] File uploaded successfully: ${bucketName}/${key}`);
    return `https://${bucketName}.s3.amazonaws.com/${key}`;
}
