import { ApiExtraModels } from "@nestjs/swagger";

@ApiExtraModels(StandardApiResponse)
export class StandardApiResponse<T = any> {
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;

    constructor(statusCode: number, message: string, data?: T) {
        this.message = message;
        this.statusCode = statusCode;
        this.success = statusCode >= 200 && statusCode < 300;
        this.data = data;
    }
}