import { HttpException, HttpStatus } from '@nestjs/common';

export class LoginThrottlingException extends HttpException {
    constructor() {
        super('Too many login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
}
