import { Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';

@Injectable()
class MyThrottlerGuard extends ThrottlerGuard {
    async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
        throw new ThrottlerException("Too many login attempts. Please try again later.");
    }
}