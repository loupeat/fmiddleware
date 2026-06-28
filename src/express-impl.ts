import {FMiddleware} from "./middleware";
import {FHttpMethod, FRequest, FResponse} from "./types";
import {isBinary, isUrlEncoded, normalizedContentType, parseUrlEncoded} from "./content-type";

interface QueryStringParameters {
    queryStringParameters: Record<string, string> | null;
    multiValueQueryStringParameters: Record<string, string[]> | null;
}

/**
 * Middleware implementation for Express.js.
 */
export class FExpressMiddleware extends FMiddleware<any, any> {

    static headers(): Record<string, string> {
        return {
            "Access-Control-Allow-Origin": "*"
        };
    }

    /**
     * Set default headers for the middleware.
     */
    constructor() {
        super(FExpressMiddleware.headers());
    }

    /**
     * Extracts the HTTP method from the Express request and maps it to the FHttpMethod enum.
     *
     * @param expressMethod
     * @private
     */
    private httpMethod(expressMethod: string): FHttpMethod {
        return expressMethod as FHttpMethod;
    }

    /**
     * Extract query string parameters from the Express request.
     */
    private queryStringParameters(request: any): QueryStringParameters {
        const result: QueryStringParameters = {
            queryStringParameters: {},
            multiValueQueryStringParameters: {}
        };
        if (request.query) {
            for (const key in request.query) {
                if (Object.prototype.hasOwnProperty.call(request.query, key)) {
                    const value = request.query[key];
                    if (Array.isArray(value)) {
                        result.multiValueQueryStringParameters![key] = value;
                    } else {
                        result.queryStringParameters![key] = value;
                    }
                }
            }
        }
        return result;
    }

    /**
     * Maps the headers from the Express request to a Record<string, string>.
     *
     * @param request
     * @private
     */
    private mapHeaders(request: any): Record<string, string> {
        const headers: Record<string, string> = {};
        if (request.headers) {
            for (const key in request.headers) {
                if (Object.prototype.hasOwnProperty.call(request.headers, key)) {
                    headers[key] = request.headers[key];
                }
            }
        }
        return headers;
    }

    /**
     * Extracts the body from the Express request.
     *
     * The shape of the returned body depends on the request `Content-Type`:
     * - Binary/passthrough types (e.g. `application/octet-stream`) keep the raw
     *   `Buffer` untouched (the consumer must register `express.raw(...)`).
     * - `application/x-www-form-urlencoded` is parsed into a flat record (unless
     *   the consumer already parsed it into an object via `express.urlencoded()`).
     * - Buffers for textual types are decoded to a UTF-8 string; objects are
     *   passed through unchanged.
     *
     * @param request
     * @private
     */
    private body<T>(request: any): T {
        const body = request.body;
        const contentType = normalizedContentType(request.headers);

        if (Buffer.isBuffer(body)) {
            if (isBinary(contentType)) {
                return body as unknown as T;
            }
            const text = body.toString("utf-8");
            if (isUrlEncoded(contentType)) {
                return parseUrlEncoded(text) as unknown as T;
            }
            return text as unknown as T;
        }

        if (typeof body === "string" && isUrlEncoded(contentType)) {
            return parseUrlEncoded(body) as unknown as T;
        }

        return body as T;
    }

    /**
     * Maps the Express request to a FRequest type.
     *
     * @param request
     */
    mapRequestType(request: any): FRequest<any, any> {
        const queryStrings = this.queryStringParameters(request);
        const headers = this.mapHeaders(request);
        const sourceIp = request.ip || request.connection.remoteAddress || "unknown";
        const body = this.body(request);
        return {
            path: request.path,
            pathParameters: {},
            queryStringParameters: queryStrings.queryStringParameters,
            multiValueQueryStringParameters: queryStrings.multiValueQueryStringParameters,
            httpMethod: this.httpMethod(request.method),
            body,
            isBase64Encoded: false,
            headers: headers,
            multiValueHeaders: {},
            originalRequestSource: "express",
            originalRequest: request,
            context: {},
            sourceIp: sourceIp
        };
    }

    /**
     * Just returns the FResponse as the mapping needs to be done in Express middleware.
     *
     * @param response
     */
    mapResponseType(response: FResponse<any, any, any>): FResponse<any, any, any> {
        return response;
    }

}
