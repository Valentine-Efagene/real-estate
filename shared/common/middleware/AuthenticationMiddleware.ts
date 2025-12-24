import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export default class AuthenticationMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction) {
        // No-op authentication middleware for now. Consumers should attach
        // a real implementation or use a guard. This prevents build-time errors
        // where the middleware is referenced.
        // It preserves any existing req.user if already set by upstream middleware.
        return next();
    }
}
