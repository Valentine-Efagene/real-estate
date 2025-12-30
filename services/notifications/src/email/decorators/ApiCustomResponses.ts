import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDto, SuccessResponseDto } from '../email.dto';

// Custom decorator to combine all Swagger decorators
export function ApiCustomResponses(summary?: string, description?: string) {
    return applyDecorators(
        ApiOperation({ summary, description }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'The request has succeeded.',
            type: SuccessResponseDto,
        }),
        ApiResponse({
            status: HttpStatus.BAD_REQUEST,
            description: 'Validation',
            type: ErrorResponseDto,
        }),
    );
}
