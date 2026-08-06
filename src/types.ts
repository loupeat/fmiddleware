

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

/**
 * True for the error classes the middleware answers with a 4xx: a client asked
 * for something it may not have or does not exist, and the API handled that
 * correctly. Such a throw is an expected outcome, not a fault, which is why the
 * middleware logs it at `warn` and reserves `error` for the 500 path.
 *
 * Subclasses count — a per-entity `ForbiddenError` subclass is still a 403.
 *
 * Keep this list in step with `FMiddlewareDefaultErrorProcessor`, which maps the
 * same classes to their status codes. A class present there but missing here
 * gets a 4xx response with an `[ERROR]` line, which is exactly the mismatch this
 * predicate exists to prevent.
 */
export function isClientError(error: unknown): boolean {
    return (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof AuthenticationError ||
        error instanceof ForbiddenError ||
        error instanceof ConflictError
    );
}
