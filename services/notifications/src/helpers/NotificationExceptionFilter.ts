import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class NotificationExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const metadata: { httpStatusCode: number } = exception['$metadata']
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        if (metadata) {
            const err = exception as ISesException
            const statusCode = err.$metadata?.httpStatusCode ?? 500

            response.status(statusCode).json({
                success: false,
                statusCode,
                message: err.message,
                details: err.Error
            });

            return
        }

        const errorResponse = exception['response']

        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        response.status(status).json({
            success: false,
            statusCode: status,
            message: errorResponse?.['message'],
        });
    }
}
