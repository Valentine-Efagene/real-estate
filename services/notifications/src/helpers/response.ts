export interface StandardApiResponse<T = unknown> {
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;
}

export function createResponse<T>(
    statusCode: number,
    message: string,
    data?: T
): StandardApiResponse<T> {
    return {
        success: statusCode >= 200 && statusCode < 300,
        statusCode,
        message,
        data,
    };
}
