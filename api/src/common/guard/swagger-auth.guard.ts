import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

export function SwaggerAuth() {
    return applyDecorators(
        // UseGuards(AuthGuard),
        ApiBearerAuth()
    );
}
