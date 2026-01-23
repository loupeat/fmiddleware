import {FHandler, FMiddleware, RequestPreProcessor, ResponsePostProcessor} from "./middleware";
import {
    AuthenticationError,
    ConflictError,
    ForbiddenError,
    FRequest,
    FResponse,
    NotFoundError,
    ValidationError
} from "./types";
import {validator} from "./validation";
import {logger} from "./logger";

export const FMiddlewareDefaultValidationProcessor: RequestPreProcessor = {
    name: "FMiddlewareDefaultValidationProcessor",
    pathPatterns: ["/**"],
    requestSource: "*",
    process: async (_api: FMiddleware<any, any>, request: FRequest<any, any>, handler: FHandler<any, any>): Promise<void> => {
        if (handler.schema) {
            if (!request.body) {
                throw new ValidationError("Request body is required but was not provided.");
            }
            validator.validate(handler.schema, request.body);
        }
    }
};

export const FMiddlewareDefaultErrorProcessor: ResponsePostProcessor = {
    name: "FMiddlewareDefaultErrorProcessor",
    pathPatterns: ["/**"],
    requestSource: "*",
    process: async (_api: FMiddleware<any, any>, response: FResponse<any, any, any>): Promise<void> => {
        if (response.error) {
            if (response.error instanceof NotFoundError) {
                response.statusCode = 404;
                response.body = {
                    error: "Not Found",
                    message: response.error.message || "The requested resource was not found."
                };
            }
            if (response.error instanceof ValidationError) {
                response.statusCode = 400;
                response.body = {
                    error: "Bad Request",
                    message: response.error.message || "The request was invalid or cannot be served."
                };
            }
            if (response.error instanceof AuthenticationError) {
                response.statusCode = 401;
                response.body = {
                    error: "Unauthorized",
                    message: response.error.message || "Authentication is required and has failed or has not yet been provided."
                };
            }
            if (response.error instanceof ForbiddenError) {
                response.statusCode = 403;
                response.body = {
                    error: "Forbidden",
                    message: response.error.message || "You do not have permission to access this resource."
                };
            }
            if (response.error instanceof ConflictError) {
                response.statusCode = 409;
                response.body = {
                    error: "Conflict",
                    message: response.error.message || "The request could not be completed due to a conflict with the current state of the resource."
                };
            }
        }
        // Do not adjust the response if there is no error or if the error is not of any known type.
    }
};

let servedRequests = 0;

export const FMiddlewareDefaultStatsLoggingProcessor: ResponsePostProcessor = {
    name: "FMiddlewareDefaultStatsLoggingProcessor",
    pathPatterns: ["/**"],
    requestSource: "*",
    process: async (api: FMiddleware<any, any>, _response: FResponse<any, any, any>): Promise<void> => {
        servedRequests ++;
        logger.info(`Started at: ${api.createdAt.toISO()}, up since: ${api.createdAt.toRelative()}, served requests: ${servedRequests}`);
    }
};
