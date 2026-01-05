import { Router, Request, Response, NextFunction } from 'express';
import { getWhatsappService } from '../services/whatsapp.service';
import { createResponse } from '../helpers/response';
import { SendWhatsAppMessageSchema } from '../validators/whatsapp.validator';

const router = Router();
const whatsappService = getWhatsappService();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post('/send', asyncHandler(async (req: Request, res: Response) => {
    const parsed = SendWhatsAppMessageSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json(createResponse(400, 'Validation error', parsed.error.issues));
        return;
    }

    const response = await whatsappService.sendMessage(parsed.data);
    res.json(createResponse(200, 'Message sent', response));
}));

export default router;
