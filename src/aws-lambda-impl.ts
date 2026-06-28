import {FMiddleware} from "./middleware";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import {FHttpMethod, FRequest, FResponse} from "./types";
import {isBinary, isUrlEncoded, normalizedContentType, parseUrlEncoded} from "./content-type";

/**
 * Middleware implementation for AWS Lambda using API Gateway Proxy Events.
 */
export class FAWSLambdaMiddleware extends FMiddleware<APIGatewayProxyEvent, APIGatewayProxyResult> {

    static headers(): Record<string, string> {
        return {
            "Access-Control-Allow-Origin": "*"
        };
    }

    /**
     * Set default headers for the middleware.
     */
    constructor() {
        super(FAWSLambdaMiddleware.headers());
    }

    /**
     * Extracts the body from the APIGatewayProxyEvent.
     *
     * The shape of the returned body depends on the request `Content-Type`:
     * - `application/x-www-form-urlencoded` is parsed into a flat record.
     * - Binary/passthrough types (e.g. `application/octet-stream`) are exposed as
     *   a `Buffer` without attempting `JSON.parse` (base64 bodies are decoded).
     * - Everything else is parsed as JSON, falling back to the raw string.
     *
     * @param event
     * @private
     */
    private body<T>(event: APIGatewayProxyEvent): T {
        const body = event.body;
        if (typeof body !== "string") {
            return body as T;
        }

        const contentType = normalizedContentType(event.headers);

        if (isBinary(contentType)) {
            return Buffer.from(body, event.isBase64Encoded ? "base64" : "utf-8") as unknown as T;
        }

        const decoded = event.isBase64Encoded ? Buffer.from(body, "base64").toString("utf-8") : body;

        if (isUrlEncoded(contentType)) {
            return parseUrlEncoded(decoded) as unknown as T;
        }

        try {
            return JSON.parse(decoded) as T;
        } catch (error) {
            console.warn(`Failed to parse request body as JSON, see stack trace for details, using body as is.`);
            return decoded as unknown as T;
        }
    }

    /**
     * Extracts the HTTP method from the APIGatewayProxyEvent and maps it to the FHttpMethod enum.
     *
     * @param event
     * @private
     */
    private httpMethod(event: APIGatewayProxyEvent): FHttpMethod {
        return event.httpMethod as FHttpMethod;
    }

    /**
     * Maps the APIGatewayProxyEvent to a FRequest type.
     *
     * @param event
     */
    mapRequestType(event: APIGatewayProxyEvent): FRequest<APIGatewayProxyEvent, any> {
        const body = this.body(event);
        const httpMethod = this.httpMethod(event);
        const sourceIp = event.requestContext.identity.sourceIp;
        const convertedHeaders: Record<string, string> = {};
        if (event.headers) {
            for (const key of Object.keys(event.headers)) {
                const lowerKey = key.toLowerCase();
                convertedHeaders[lowerKey] = event.headers[key]!;
            }
        }
        const convertedMultiValueHeaders: Record<string, string[]> = {};
        if (event.multiValueHeaders) {
            for (const key of Object.keys(event.multiValueHeaders)) {
                const lowerKey = key.toLowerCase();
                convertedMultiValueHeaders[lowerKey] = event.multiValueHeaders[key]!;
            }
        }
        // Convert query string parameters (filter out undefined values)
        let queryStringParameters: Record<string, string> | null = null;
        if (event.queryStringParameters) {
            queryStringParameters = {};
            for (const [key, value] of Object.entries(event.queryStringParameters)) {
                if (value !== undefined) {
                    queryStringParameters[key] = value;
                }
            }
        }

        let multiValueQueryStringParameters: Record<string, string[]> | null = null;
        if (event.multiValueQueryStringParameters) {
            multiValueQueryStringParameters = {};
            for (const [key, value] of Object.entries(event.multiValueQueryStringParameters)) {
                if (value !== undefined) {
                    multiValueQueryStringParameters[key] = value;
                }
            }
        }

        return {
            path: event.path,
            pathParameters: {},
            queryStringParameters,
            multiValueQueryStringParameters,
            httpMethod,
            body,
            isBase64Encoded: event.isBase64Encoded,
            headers: convertedHeaders,
            multiValueHeaders: convertedMultiValueHeaders,
            originalRequestSource: "aws-lambda",
            originalRequest: event,
            context: {},
            sourceIp
        };
    }

    /**
     * Maps the FResponse type to an APIGatewayProxyResult.
     *
     * @param response
     */
    mapResponseType(response: FResponse<APIGatewayProxyEvent, any, any>): APIGatewayProxyResult {
        let body: string;
        if (response.body === undefined || response.body === null) {
            body = "";
        } else if (typeof response.body === "string") {
            body = response.body;
        } else if (Buffer.isBuffer(response.body)) {
            body = response.body.toString("base64");
            response.isBase64Encoded = true;
        } else {
            body = JSON.stringify(response.body, null, 2);
        }
        return {
            statusCode: response.statusCode,
            body: body,
            headers: response.headers,
            multiValueHeaders: response.multiValueHeaders,
            isBase64Encoded: response.isBase64Encoded
        };
    }

}
