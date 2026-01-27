import {FHttpMethod, FRequest, FResponse, ValidationError} from "./types";
import {
    FMiddlewareDefaultErrorProcessor,
    FMiddlewareDefaultStatsLoggingProcessor,
    FMiddlewareDefaultValidationProcessor
} from "./default-impl";
import {DateTime} from "luxon";
import {logger} from "./logger";
import {OpenAPIMetadata} from "./openapi/types";

const luxonDate = () => DateTime.local();

export class Helper {

    static stripTrailingSlash(path: string): string {
        if (path.endsWith("/")) {
            return path.slice(0, -1);
        }
        return path;
    }

    static isPathVariable(patternElement: string): boolean {
        // A path variable is defined as a string that starts with '{' and ends with '}'.
        return patternElement.startsWith("{") && patternElement.endsWith("}");
    }

    static patternElementIsMoreSpecificThan(patternElement: string, comparePatternElement: string): boolean {
        // They are equal, not more specific
        if (patternElement == comparePatternElement) {
            return false;
        }
        // Any wildcard is not more specific than anything
        if (patternElement == "*" || patternElement == "**") {
            return false;
        }
        // Any specific element in our pattern is than a wildcard in the compare pattern
        if (comparePatternElement == "*" || comparePatternElement == "**") {
            return true;
        }
        // If the path element is static and the compare pattern element is a path variable, then the pattern is more specific
        if (!this.isPathVariable(patternElement) && this.isPathVariable(comparePatternElement)) {
            return true;
        }
        // If both are path variables or static, we cannot determine which one is more specific
        return false;
    }

    static patternIsMoreSpecificThan(pattern: string, comparePattern: string): boolean {
        const patternElements = pattern.split("/");
        const comparePatternElements = comparePattern.split("/");
        if (patternElements.length < comparePatternElements.length) {
            return false;
        }
        for (let i = 0; i < comparePatternElements.length; i++) {
            const patternElement = patternElements[i];
            const comparePatternElement = comparePatternElements[i];
            if (this.patternElementIsMoreSpecificThan(patternElement, comparePatternElement)) {
                return true;
            }
        }
        return false;
    }

    static matchesAnyPathPattern(path: string, pathPatterns: string[]): boolean {
        for (const pathPattern of pathPatterns) {
            if (this.matchesPath(path, pathPattern)) {
                return true;
            }
        }
        return false;
    }

    static matchesPath(path: string, pathPattern: string): boolean {
        const pathElements = path.split("/");
        const patternElements = pathPattern.split("/");

        if (patternElements.length > pathElements.length) {
            return false;
        }

        for (let i = 0; i < pathElements.length; i++) {
            const patternElement = patternElements[i];
            const pathElement = pathElements[i];

            if (patternElement == "*") {
                continue;
            }
            if (patternElement == "**") {
                return true;
            }
            if (patternElement && patternElement.startsWith("{") && patternElement.endsWith("+}")) {
                return true;
            }
            if (i >= patternElements.length) {
                return false;
            }
            if (!Helper.isPathVariable(patternElement) && patternElement != pathElement) {
                return false;
            }
        }
        return true;
    }

    static matchesHttpMethod(requestMethod: FHttpMethod, patternMethods?: FHttpMethod[]): boolean {
        if (!patternMethods) {
            patternMethods = [FHttpMethod.GET, FHttpMethod.POST, FHttpMethod.PUT, FHttpMethod.DELETE];
        }
        return patternMethods.includes(requestMethod);
    }

    static matchesOriginalRequestSource(requestSource: string, pattern: string): boolean {
        if (pattern == "*") {
            return true;
        } else {
            return requestSource == pattern;
        }
    }

    static extractPathParameters(pathPattern: string, path: string): Record<string, string> {
        const pathPatternElements = pathPattern.split("/");
        const pathElements = path.split("/");
        const pathParameters: Record<string, string> = {};
        if (pathPatternElements.length > pathElements.length) {
            throw new Error(`Path pattern ${pathPattern} has more elements than the actual path ${path}, cannot extract path parameters.`);
        }
        for (let i = 0; i < pathPatternElements.length; i++) {
            const patternElement = pathPatternElements[i];
            if (Helper.isPathVariable(patternElement)) {
                let wildcardPlaceholder = false;
                let placeholderName = patternElement.slice(1, -1);
                if (placeholderName.endsWith("+")) {
                    wildcardPlaceholder = true;
                    placeholderName = placeholderName.slice(0, -1);
                }
                if (pathParameters[placeholderName]) {
                    throw new Error(`Path pattern ${pathPattern} has duplicate placeholder ${placeholderName}, cannot extract path parameters.`);
                }
                if (wildcardPlaceholder) {
                    pathParameters[placeholderName] = pathElements.slice(i).join("/");
                } else {
                    pathParameters[placeholderName] = pathElements[i];
                }
            } else if (patternElement != "*" && patternElement != "**" && patternElement !== pathElements[i]) {
                throw new Error(`Path pattern ${pathPattern} does not match actual path ${path}, cannot extract path parameters.`);
            }
        }
        return pathParameters;
    }

    static logPathParameters(pathParameters: Record<string, string>): string {
        return Object.entries(pathParameters)
            .map(([key, value]) => `${key}=${value}`)
            .join(", ");
    }

    static logHttpMethod(httpMethod: FHttpMethod): string {
        return httpMethod.padEnd(6, " ");
    }

    static logRequest(request: FRequest<any, any>): string {
        return `${this.logHttpMethod(request.httpMethod)}: ${request.path}`;
    }

    static logHandler(handler: FHandler<any, any>): string {
        return `${this.logHttpMethod(handler.httpMethod)}: ${handler.pathPattern}`;
    }
}

/**
 * Interface for a handler that processes requests in the middleware.
 */
export interface FHandler<RequestBodyType, ResponseBodyType> {

    pathPattern: string;
    httpMethod: FHttpMethod;
    process: (request: FRequest<any, RequestBodyType>) => Promise<FResponse<any, RequestBodyType, ResponseBodyType>>;
    schema?: any;
    /** OpenAPI metadata for documentation generation */
    openapi?: OpenAPIMetadata;

}

/**
 * These processors can be called before the actual workload processing of the request.
 */
export interface RequestPreProcessor {

    name: string;
    httpMethods?: FHttpMethod[];
    pathPatterns: string[];
    requestSource: string;
    process: <OriginalRequestType>(api: FMiddleware<any, any>, request: FRequest<OriginalRequestType, any>, handler: FHandler<any, any>) => Promise<void>;

}

/**
 * These processors can be called after the actual workload processing of the request.
 */
export interface ResponsePostProcessor {

    name: string;
    pathPatterns: string[];
    requestSource: string;
    process: <OriginalRequestType>(api: FMiddleware<any, any>, request: FResponse<OriginalRequestType, any, any>, error?: any) => Promise<void>;

}

/**
 * Middleware class that retrieves requests and processes them through registered request processors.
 * Processing has four phases, textual processing, pre-processing, actual workload processing and post-processing.
 */
export abstract class FMiddleware<OriginalRequestType, OriginalResponseType> {

    readonly createdAt: DateTime;

    readonly defaultHeaders: Record<string, string>;

    readonly requestPreProcessors: RequestPreProcessor[];
    readonly handlers: FHandler<any, any>[];
    readonly responsePostProcessors: ResponsePostProcessor[];

    private pathPrefix?: string;

    abstract mapRequestType(request: OriginalRequestType): FRequest<OriginalRequestType, any>;
    abstract mapResponseType(response: FResponse<OriginalRequestType, any, any>): OriginalResponseType;

    constructor(defaultHeaders: Record<string, string> = {}) {
        this.createdAt = luxonDate();
        this.defaultHeaders = defaultHeaders;
        this.requestPreProcessors = [];
        this.addRequestPreProcessor(FMiddlewareDefaultValidationProcessor);
        this.handlers = [];
        this.responsePostProcessors = [];
        this.addResponsePostProcessor(FMiddlewareDefaultErrorProcessor);
        this.addResponsePostProcessor(FMiddlewareDefaultStatsLoggingProcessor);
    }

    setPathPrefix(pathPrefix?: string) {
        if (pathPrefix) {
            logger.info(`Setting path prefix to ${pathPrefix} ignoring handlers not starting with this prefix`);
        }
        this.pathPrefix = pathPrefix;
    }

    /**
     * Registers a handler for the middleware. Bails out if another handler for the same path and method is already registered.
     * @param handler
     */
    addHandler(handler: FHandler<any, any>) {
        if (this.pathPrefix && !handler.pathPattern.startsWith(this.pathPrefix)) {
            logger.debug(`Skipping handler registration for ${Helper.logHandler(handler)} as it does not match the path prefix ${this.pathPrefix}`);
            return;
        }
        if (!handler.pathPattern || !handler.httpMethod) {
            throw new Error("Handler must have a path pattern and an HTTP method defined.");
        }
        handler.pathPattern = Helper.stripTrailingSlash(handler.pathPattern);
        if (this.handlers.some((h) => h.pathPattern == handler.pathPattern && h.httpMethod == handler.httpMethod)) {
            throw new Error(`Handler for path ${handler.pathPattern} and method ${handler.httpMethod} already registered.`);
        }
        logger.debug(`Registering handler for ${Helper.logHandler(handler)}`);
        this.handlers.push(handler);
    }

    getHandlers(): FHandler<any, any>[] {
        return this.handlers;
    }

    rest<RequestBodyType, ResponseBodyType>(pathPattern: string, httpMethod: FHttpMethod, process: (request: FRequest<any, RequestBodyType>) => Promise<FResponse<any, RequestBodyType, ResponseBodyType>>, schema?: any, openapi?: OpenAPIMetadata) {
        if ((httpMethod == FHttpMethod.POST || httpMethod == FHttpMethod.PUT) && !schema) {
            logger.warn(`No schema provided for ${Helper.logHttpMethod(httpMethod)}: ${pathPattern}. This may lead to validation issues.`);
        }
        this.addHandler({
            pathPattern: Helper.stripTrailingSlash(pathPattern),
            httpMethod: httpMethod,
            process: process,
            schema: schema,
            openapi: openapi
        });
    }

    get<ResponseBodyType>(pathPattern: string, process: (request: FRequest<any, any>) => Promise<FResponse<any, any, ResponseBodyType>>, openapi?: OpenAPIMetadata) {
        this.rest<any, ResponseBodyType>(pathPattern, FHttpMethod.GET, process, undefined, openapi);
    }

    post<RequestBodyType, ResponseBodyType>(pathPattern: string, process: (request: FRequest<any, RequestBodyType>) => Promise<FResponse<any, RequestBodyType, ResponseBodyType>>, schema?: any, openapi?: OpenAPIMetadata) {
        this.rest<RequestBodyType, ResponseBodyType>(pathPattern, FHttpMethod.POST, process, schema, openapi);
    }

    put<RequestBodyType, ResponseBodyType>(pathPattern: string, process: (request: FRequest<any, RequestBodyType>) => Promise<FResponse<any, RequestBodyType, ResponseBodyType>>, schema?: any, openapi?: OpenAPIMetadata) {
        this.rest<RequestBodyType, ResponseBodyType>(pathPattern, FHttpMethod.PUT, process, schema, openapi);
    }

    delete<RequestBodyType, ResponseBodyType>(pathPattern: string, process: (request: FRequest<any, RequestBodyType>) => Promise<FResponse<any, RequestBodyType, ResponseBodyType>>, schema?: any, openapi?: OpenAPIMetadata) {
        this.rest<RequestBodyType, ResponseBodyType>(pathPattern, FHttpMethod.DELETE, process, schema, openapi);
    }

    addRequestPreProcessor(requestPreProcessor: RequestPreProcessor) {
        logger.debug(`Registering pre-processor ${requestPreProcessor.name} for [${requestPreProcessor.pathPatterns.join(", ")}]`);
        this.requestPreProcessors.push(requestPreProcessor);
    }

    addResponsePostProcessor(responsePostProcessor: ResponsePostProcessor) {
        logger.debug(`Registering post-processor ${responsePostProcessor.name} for [${responsePostProcessor.pathPatterns}]`);
        this.responsePostProcessors.push(responsePostProcessor);
    }

    private error(request: FRequest<any, any>, statusCode: number, error: string, message: string): OriginalResponseType {
        const errorObject = {
            code: error,
            message: message,
        };
        return this.mapResponseType({
            statusCode: statusCode,
            body: errorObject,
            error: errorObject,
            headers: this.defaultHeaders,
            multiValueHeaders: {},
            isBase64Encoded: false,
            request: request
        });
    }

    private findHandler(request: FRequest<any, any>): FHandler<any, any> | undefined {
        const candidates = this.handlers.filter((h) =>
            Helper.matchesPath(request.path, h.pathPattern) &&
            request.httpMethod === h.httpMethod
        );
        if (candidates.length == 0) {
            return undefined;
        } else if (candidates.length == 1) {
            return candidates[0];
        } else {
            let currentCandidate = candidates[0];
            for (let i = 1; i < candidates.length; i++) {
                if (Helper.patternIsMoreSpecificThan(candidates[i].pathPattern, currentCandidate.pathPattern)) {
                    currentCandidate = candidates[i];
                }
            }
            return currentCandidate;
        }
    }

    hasHandlers(): boolean {
        return this.handlers.length > 0;
    }

    /**
     * Low level processing which first maps the request from the original request type to the FRequest type,
     * if succeeds it then processes the request through all registered request pre-processors, processes the workload
     * and then processes the response through all registered response post-processors.
     */
    async process(originalRequest: OriginalRequestType): Promise<OriginalResponseType> {
        const request = this.mapRequestType(originalRequest);
        await logger.debug(`Processing ${request.originalRequestSource} request for ${Helper.logRequest(request)}`);

        const handler = this.findHandler(request);
        if (!handler) {
            await logger.warn(`No handler found for path ${Helper.logHttpMethod(request.httpMethod)}: ${request.path}`);
            return this.error(request, 404, "Not found", "The requested resource was not found.");
        }

        // Find path parameter like {tenantId} in the handlers path pattern
        request.pathParameters = Helper.extractPathParameters(handler.pathPattern, request.path);
        await logger.debug(`Extracted ${Helper.logPathParameters(request.pathParameters)} from ${request.originalRequestSource} request for ${Helper.logRequest(request)}`);

        let response: FResponse<any, any, any>;

        // Process request pre-processors
        let preprocessingError: Error | undefined = undefined;
        await logger.debug(`Checking ${this.requestPreProcessors.length} pre-processors for [${request.path}] ${request.originalRequestSource}`);
        for (const preProcessor of this.requestPreProcessors) {
            await logger.debug(`Checking pre-processor ${preProcessor.name} for [${preProcessor.pathPatterns.join(", ")}] / [${request.path}] and  [${preProcessor.requestSource}] / [${request.originalRequestSource}]`);
            if (Helper.matchesHttpMethod(request.httpMethod, preProcessor.httpMethods) && Helper.matchesAnyPathPattern(request.path, preProcessor.pathPatterns) && Helper.matchesOriginalRequestSource(request.originalRequestSource, preProcessor.requestSource)) {
                try {
                    await logger.debug(`Executing pre-processor ${preProcessor.name} for [${preProcessor.pathPatterns.join(", ")}] / ${Helper.logRequest(request)}`);
                    await preProcessor.process(this, request, handler);
                } catch (error) {
                    await logger.error(`Error in pre-processor ${preProcessor.name}:`, error);
                    preprocessingError = error instanceof Error ? error : new Error(String(error));
                    break;
                }
            }
        }

        if (preprocessingError) {
            // If there was an error in pre-processing, we skip the workload processing
            response = this.responses._(request, 500, "Internal server error");
            response.error = preprocessingError;
        } else {
            // Process the actual workload
            try {
                await logger.debug(`Processing handler [${handler.httpMethod}]: ${handler.pathPattern} for ${Helper.logRequest(request)}`);
                response = await handler.process(request);
            } catch (error) {
                await logger.error(`Error in handler [${handler.httpMethod}]: ${handler.pathPattern}:`, error);
                response = this.responses._(request, 500, "Internal server error");
                response.error = error instanceof Error ? error : new Error(String(error));
            }
        }
        response.headers = response.headers || this.defaultHeaders;

        // Process response post-processors
        await logger.debug(`Checking ${this.responsePostProcessors.length} post-processors for [${request.path}] ${request.originalRequestSource}`);
        for (const postProcessor of this.responsePostProcessors) {
            await logger.debug(`Checking post-processor ${postProcessor.name} for [${postProcessor.pathPatterns}] / ${Helper.logRequest(request)} and [${postProcessor.requestSource}] / [${request.originalRequestSource}]`);
            if (Helper.matchesAnyPathPattern(request.path, postProcessor.pathPatterns) && Helper.matchesOriginalRequestSource(request.originalRequestSource, postProcessor.requestSource)) {
                try {
                    await logger.debug(`Executing post-processor ${postProcessor.name} for [${postProcessor.pathPatterns}] / ${Helper.logRequest(request)}`);
                    await postProcessor.process(this, response, null);
                } catch (error) {
                    return this.error(request, 500, "Internal server error", `Error in response post-processor ${postProcessor.name}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }

        // Map the response back to the original response type
        return this.mapResponseType(response);
    }

    /**
     * Returns the path parameter value for a given parameter name.
     * @param request
     * @param parameterName
     */
    pathParameter(request: FRequest<any, any>, parameterName: string): string {
        if (!request.pathParameters) {
            throw new ValidationError(`No path parameters found for ${request.path}`);
        }
        const parameterValue = request.pathParameters[parameterName];
        if (parameterValue == undefined) {
            throw new ValidationError(`Parameter "${parameterName}" not found for ${request.path}`);
        }
        try {
            return decodeURIComponent(parameterValue);
        } catch {
            throw new ValidationError(`Invalid URL encoding in parameter "${parameterName}"`);
        }
    }

    queryStringParameter(request: FRequest<any, any>, parameterName: string): string {
        if (!request.queryStringParameters) {
            throw new ValidationError(`No query string parameters found for ${request.path}`);
        }
        const parameterValue = request.queryStringParameters[parameterName];
        if (parameterValue == undefined) {
            throw new ValidationError(`Query string parameter "${parameterName}" not found for ${request.path}`);
        }
        return parameterValue;
    }

    queryStringParameterOptional(request: FRequest<any, any>, parameterName: string): string | undefined {
        if (!request.queryStringParameters) {
            return undefined;
        }
        return request.queryStringParameters[parameterName];
    }

    /**
     * Returns the context value for a given key.
     * Fails if the element is not present in the request context.
     *
     * @param request
     * @param key
     */
    context<ContextType>(request: FRequest<any, any>, key: string): ContextType {
        const contextValue = request.context[key];
        if (contextValue == undefined) {
            throw new Error(`Context value "${key}" not found in request context`);
        }
        return contextValue as ContextType;
    }

    headers(headers: Record<string, string>): Record<string, string> {
        return {
            ...this.defaultHeaders,
            ...headers
        };
    }

    readonly responses = {
        _: <RequestBodyType, ResponseBodyType>(request: FRequest<any, RequestBodyType>, statusCode: number, body: ResponseBodyType, headers?: Record<string, string>): FResponse<any, RequestBodyType, ResponseBodyType> => (
            {
                statusCode: statusCode,
                body: body,
                headers: headers || this.defaultHeaders,
                multiValueHeaders: {},
                isBase64Encoded: false,
                request: request
            }),
        OK: <RequestBodyType, ResponseBodyType>(request: FRequest<any, RequestBodyType>, body: ResponseBodyType, headers?: Record<string, string>): FResponse<any, RequestBodyType, ResponseBodyType> => (
            {
                statusCode: 200,
                body: body,
                headers: headers || this.defaultHeaders,
                multiValueHeaders: {},
                isBase64Encoded: false,
                request: request
            }),
        NoContent: <RequestBodyType>(request: FRequest<any, RequestBodyType>, headers?: Record<string, string>): FResponse<any, RequestBodyType, any> => ({
                statusCode: 204,
                body: {},
                headers: headers || this.defaultHeaders,
                multiValueHeaders: {},
                isBase64Encoded: false,
                request: request
        }),
        NotFound:(request: FRequest<any, any>, message: string): FResponse<any, any, any> => (
            {
                statusCode: 404,
                body: {
                    message
                },
                headers: this.defaultHeaders,
                multiValueHeaders: {},
                isBase64Encoded: false,
                request: request
            }),
        BadRequest:(request: FRequest<any, any>, message: string): FResponse<any, any, any> => (
            {
                statusCode: 400,
                body: {
                    message
                },
                headers: this.defaultHeaders,
                multiValueHeaders: {},
                isBase64Encoded: false,
                request: request
            })
    };

}
