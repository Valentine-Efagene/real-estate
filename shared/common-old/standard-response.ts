import { ApiExtraModels } from "@nestjs/swagger";

@ApiExtraModels(StandardApiResponse)
export class StandardApiResponse<T = any> {
    ok: boolean
    status: number;
    message: string;
    body?: T;

    constructor(status: number, message: string, body?: T) {
        this.message = message;
        this.status = status;
        this.body = body;
        this.ok = status >= 200 && status < 300;
    }
}
