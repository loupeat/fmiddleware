import {FMiddleware} from "./middleware";
import {FHttpMethod, FRequest, FResponse} from "./types";

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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true"
        };
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
     * @param request
     * @private
     */
    private body<T>(request: any): T {
        let body = request.body;
        if (Buffer.isBuffer(body)) {
            return body.toString("utf-8") as unknown as T;
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
