import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AccessLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use = (request: Request, response: Response, next: NextFunction): void => {
    const { ip, method, originalUrl: url } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // 👇 capture body but don’t log yet
    const originalSend = response.send;
    let responseBody: any;

    response.send = function (body?: any): Response {
      responseBody = body;
      return originalSend.call(this, body);
    };

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');
      const responseTime = Date.now() - startTime;

      const message = {
        method,
        url,
        statusCode,
        contentLength,
        responseTime: `${responseTime}ms`,
        userAgent,
        ip,
        timestamp: new Date().toISOString(),
      };

      if (statusCode >= 500) {
        this.logger.error(JSON.stringify(message));

        // 👇 only log the response body here
        try {
          if (typeof responseBody === 'object') {
            console.log('Response body:', JSON.stringify(responseBody, null, 2));
          } else {
            console.log('Response body:', responseBody);
          }
        } catch (err) {
          console.log('Response body (unserializable):', responseBody);
        }
      } else {
        this.logger.log(JSON.stringify(message));
      }
    });

    next();
  };
}
