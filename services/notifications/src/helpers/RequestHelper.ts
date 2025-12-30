export default class RequestHelper {
    public static getBearerToken(request: Request) {
        return request.headers['authorization']?.split(' ')?.[1]
    }

    public static getAuthorizationHeader(request: Request) {
        return request.headers['authorization']
    }
}