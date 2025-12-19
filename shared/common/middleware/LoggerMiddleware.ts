import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const { method, originalUrl } = req;
        const timestamp = new Date().toISOString();
        const userId = req.headers['user_id'];

        Logger.log(`[${timestamp}] ${method} ${originalUrl} by user ${userId}`);

        res.on('finish', () => {
            const { statusCode } = res;
            Logger.log(`[${timestamp}] ${method} ${originalUrl} ${statusCode} by user ${userId}`);
        });

        next();
    }
}
