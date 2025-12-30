import { BadRequestException, HttpStatus, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { AxiosError } from "axios";
import { AxiosErrorCode } from "../app.enum";

export default class ErrorHelper {
    public static appropriateError(error: AxiosError) {
        if (error.code == AxiosErrorCode.ECONNREFUSED) {
            return new InternalServerErrorException('Connection refused by third party')
        }

        const _message = error?.response?.data?.['message']
        const message = `3rd party: ${_message}`

        switch (error?.response?.status) {
            case HttpStatus.BAD_REQUEST:
                return new BadRequestException(message)

            case HttpStatus.UNAUTHORIZED:
                return new UnauthorizedException(message)

            default:
                return new BadRequestException(message)
        }
    }
}