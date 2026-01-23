import {FMiddleware} from "./middleware";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import {FHttpMethod, FRequest, FResponse} from "./types";

/**
 * Middleware implementation for AWS Lambda using API Gateway Proxy Events.
 */
export class FAWSLambdaMiddleware extends FMiddleware<APIGatewayProxyEvent, APIGatewayProxyResult> {

    static headers(): Record<string, string> {
        return {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true"
        };
    }

    /**
     * Set default headers for the middleware.
     */
    constructor() {
        super(FAWSLambdaMiddleware.headers());
    }

    /**
     * Extracts the body from the APIGatewayProxyEvent and parses it as JSON if it's a string.
     *
     * @param event
     * @private
     */
    private body<T>(event: APIGatewayProxyEvent): T {
        let body = event.body;
        if (typeof body === "string") {
            if (event.isBase64Encoded) {
                body = Buffer.from(body, "base64").toString("utf-8");
            }
            try {
                return JSON.parse(body) as T;
            } catch (error) {
                console.warn(`Failed to parse request body as JSON, see stack trace for details, using body as is.`);
                return body as unknown as T;
            }
        } else {
            return body as T;
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
