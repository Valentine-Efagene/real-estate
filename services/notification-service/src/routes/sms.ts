import { Router, Request, Response, NextFunction } from 'express';
import { getSmsService } from '../services/sms.service';
import { createResponse } from '../helpers/response';
import { SendSmsSchema } from '../validators/sms.validator';

const router = Router();
const smsService = getSmsService();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post('/send', asyncHandler(async (req: Request, res: Response) => {
    const parsed = SendSmsSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const response = await smsService.sendSms(parsed.data);
    res.json(createResponse(200, 'SMS sent', response));
}));

export default router;
