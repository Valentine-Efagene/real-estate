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

export enum ResponseMessage {
    INITIATED = "INITIATED",
    PAYMENT_SUCCESSFUL = "Payment Successful",
    CREATED = "Created Successfully",
    EMAIL_SENT = "Email Sent",
    UPDATED = "Updated Successfully",
    DELETED = "Deleted Successfully",
    FETCHED = "Fetched Successfully",
    DONE = "Done",
    AUTHENTICATED = "Authenticated Successfully",
    USER_SIGNUP_SUCCESSFUL = "Account created. Please check for verification email.",
}