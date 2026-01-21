import archiver from 'archiver';
import { PassThrough } from 'stream';
import {
    createPresignedPost,
    createPresignedUrl,
    deleteFromS3,
    getObject,
    uploadStream,
    getKeyFromUrl,
} from '../lib/s3-client';
import type {
    PresignedPostRequest,
    PresignedPostResponse,
    PresignedUrlRequest,
    PresignedUrlResponse,
    DeleteRequest,
    BundleRequest,
    BundleResponse,
} from '../validators/upload.validator';

class UploadService {
    /**
     * Generate a presigned POST URL for client-side uploads
     */
    async createPresignedPost(data: PresignedPostRequest): Promise<PresignedPostResponse> {
        const result = await createPresignedPost(data.folder, data.fileName, data.contentType);
        return result;
    }

    /**
     * Generate a presigned GET URL for downloading a file
     */
    async createPresignedUrl(data: PresignedUrlRequest): Promise<PresignedUrlResponse> {
        const result = await createPresignedUrl(data.url);
        return result;
    }

    /**
     * Delete a file from S3
     */
    async deleteFile(data: DeleteRequest): Promise<void> {
        await deleteFromS3(data.url);
    }

    /**
     * Bundle multiple files into a ZIP archive and return presigned URL
     */
    async bundle(data: BundleRequest): Promise<BundleResponse> {
        const FORMAT = 'zip';
        const archiveKey = `${data.archiveKey}.${FORMAT}`;

        // Create archive stream
        const archive = archiver(FORMAT, {
            zlib: { level: 9 }, // Maximum compression
        });

        archive.on('error', (error) => {
            console.error('[Bundle] Archive error:', error);
            throw error;
        });

        archive.on('warning', (warning) => {
            console.warn('[Bundle] Archive warning:', warning);
        });

        // Create passthrough stream for S3 upload
        const passthrough = new PassThrough();
        archive.pipe(passthrough);

        // Extract keys from URLs
        const objectKeys = data.objectUrls.map((url) => getKeyFromUrl(url));

        // Fetch all objects and add to archive
        const fetchPromises = objectKeys.map(async (key, index) => {
            try {
                const { Body } = await getObject(key);
                const fileName = key.split('/').at(-1) || `file-${index}`;
                archive.append(Body, { name: fileName });
                console.log(`[Bundle] Added file: ${fileName}`);
            } catch (error) {
                console.warn(`[Bundle] Failed to fetch object: ${key}`, error);
            }
        });

        await Promise.all(fetchPromises);

        // Start upload in background
        const uploadPromise = uploadStream(archiveKey, passthrough, 'application/zip');

        // Finalize archive
        await archive.finalize();
        console.log(`[Bundle] Archive finalized, size: ${archive.pointer()} bytes`);

        // Wait for upload to complete
        await uploadPromise;

        // Generate presigned URL for download
        const { presignedUrl, expiresIn } = await createPresignedUrl(archiveKey);

        return {
            presignedUrl,
            key: archiveKey,
            expiresIn,
        };
    }
}

export const uploadService = new UploadService();
