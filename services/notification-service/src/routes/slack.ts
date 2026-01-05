import { Router, Request, Response, NextFunction } from 'express';
import { getSlackService } from '../services/slack.service';
import { createResponse } from '../helpers/response';
import { SendSlackMessageSchema } from '../validators/slack.validator';

const router = Router();
const slackService = getSlackService();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post('/send', asyncHandler(async (req: Request, res: Response) => {
    const parsed = SendSlackMessageSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const response = await slackService.sendMessageWithHttp(parsed.data);
    res.json(createResponse(200, 'Message sent', response));
}));

router.post('/send-sdk', asyncHandler(async (req: Request, res: Response) => {
    const parsed = SendSlackMessageSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const response = await slackService.sendMessageWithSdk(parsed.data);
    res.json(createResponse(200, 'Message sent', response));
}));

export default router;
