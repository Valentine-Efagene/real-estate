import { Router, Request, Response, NextFunction } from 'express';
import { getPushService } from '../services/push.service';
import { createResponse } from '../helpers/response';
import {
    TokenRegistrationSchema,
    EndpointVerificationSchema,
    NotificationSchema,
} from '../validators/push.validator';

const router = Router();
const pushService = getPushService();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post('/create-application-endpoint', asyncHandler(async (req: Request, res: Response) => {
    const parsed = TokenRegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const response = await pushService.createApplicationEndpoint(parsed.data, req);
    res.json(createResponse(200, 'Endpoint created', response));
}));

router.post('/verify-endpoint', asyncHandler(async (req: Request, res: Response) => {
    const parsed = EndpointVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const response = await pushService.verifyEndpoint(parsed.data.endpointArn);
    res.json(createResponse(200, 'Endpoint verified', response));
}));

router.post('/send-notification', asyncHandler(async (req: Request, res: Response) => {
    const parsed = NotificationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const response = await pushService.sendNotification(parsed.data);
    res.json(createResponse(200, 'Notification sent', response));
}));

export default router;
