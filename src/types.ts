

export enum FHttpMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    HEAD = "HEAD",
    OPTIONS = "OPTIONS",
    PROPFIND = "PROPFIND",
    LOCK = "LOCK",
    UNLOCK = "UNLOCK"
}

export interface FRequest<OriginalRequestType, RequestBodyType> {
    path: string;
    pathParameters: Record<string, string> | null;
    queryStringParameters: Record<string, string> | null;
    multiValueQueryStringParameters: Record<string, string[]> | null;
    httpMethod: FHttpMethod;
    body: RequestBodyType |  null;
    isBase64Encoded: boolean;
    headers: Record<string, string>;
    multiValueHeaders: Record<string, string[]>;
    originalRequestSource: string;
    originalRequest: OriginalRequestType;
    context: Record<string, any>;
    sourceIp: string;
}

export interface FResponse<OriginalRequestType, RequestBodyType, ResponseBodyType> {
    statusCode: number;
    body: ResponseBodyType | null;
    error?: any;
    headers: Record<string, string>;
    multiValueHeaders: Record<string, string[]>;
    isBase64Encoded: boolean;
    request: FRequest<OriginalRequestType, RequestBodyType>;
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
    }
}

export class ConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConflictError";
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

export class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthenticationError";
    }
}

export class ForbiddenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ForbiddenError";
    }
}
