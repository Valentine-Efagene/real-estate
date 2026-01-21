import { Router, Request, Response, NextFunction } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { uploadService } from '../services/upload.service';
import {
    presignedPostRequestSchema,
    presignedUrlRequestSchema,
    deleteRequestSchema,
    bundleRequestSchema,
} from '../validators/upload.validator';

const router = Router();

/**
 * POST /upload/presigned-post
 * Generate a presigned POST URL for client-side file upload
 */
router.post('/presigned-post', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = presignedPostRequestSchema.parse(req.body);
        const result = await uploadService.createPresignedPost(data);
        res.status(200).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * POST /upload/presigned-url
 * Generate a presigned GET URL for file download
 */
router.post('/presigned-url', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = presignedUrlRequestSchema.parse(req.body);
        const result = await uploadService.createPresignedUrl(data);
        res.status(200).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /upload
 * Delete a file from S3
 */
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = deleteRequestSchema.parse(req.body);
        await uploadService.deleteFile(data);
        res.status(200).json(successResponse({ deleted: true, url: data.url }));
    } catch (error) {
        next(error);
    }
});

/**
 * POST /upload/bundle
 * Bundle multiple files into a ZIP archive
 */
router.post('/bundle', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = bundleRequestSchema.parse(req.body);
        const result = await uploadService.bundle(data);
        res.status(200).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

export default router;
