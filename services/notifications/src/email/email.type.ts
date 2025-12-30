interface ISesExceptionError {
    Type: string,
    Code: string,
    Message: string,
    message: string
}

interface ISesExceptionMetadata {
    httpStatusCode: number,
    requestId: string,
    extendedRequestId: string | undefined,
    cfId: string | undefined,
    attempts: number,
    totalRetryDelay: number
}

interface ISesException {
    Error: ISesExceptionError,
    $metadata: ISesExceptionMetadata,
    $fault: string
    message?: string // Doubtful
    Name: string | undefined
    RequestId: string
    xmlns: string
}