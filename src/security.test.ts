import { FExpressMiddleware, FAWSLambdaMiddleware, FHttpMethod } from "./index";

describe("Security", () => {
    describe("CORS headers", () => {
        test("Express default headers should not include Access-Control-Allow-Credentials", () => {
            const headers = FExpressMiddleware.headers();
            expect(headers["Access-Control-Allow-Origin"]).toBe("*");
            expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
        });

        test("Lambda default headers should not include Access-Control-Allow-Credentials", () => {
            const headers = FAWSLambdaMiddleware.headers();
            expect(headers["Access-Control-Allow-Origin"]).toBe("*");
            expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
        });
    });

    describe("Error message information leakage", () => {
        test("404 response should not leak path information", async () => {
            const api = new FExpressMiddleware();

            // Register a handler for a different path
            api.get("/api/exists", async (request) => {
                return api.responses.OK(request, { found: true });
            });

            // Mock Express request for non-existent path
            const mockRequest = {
                path: "/api/secret-internal-path/with/sensitive/data",
                method: "GET",
                headers: {},
                query: {},
                body: null,
                ip: "127.0.0.1",
                connection: { remoteAddress: "127.0.0.1" }
            };

            const response = await api.process(mockRequest);

            expect(response.statusCode).toBe(404);
            // Verify the response body doesn't contain the requested path
            const bodyString = JSON.stringify(response.body);
            expect(bodyString).not.toContain("secret-internal-path");
            expect(bodyString).not.toContain("sensitive");
            // Should have generic message
            expect(response.body.message).toBe("The requested resource was not found.");
        });
    });

    describe("Path traversal sequences", () => {
        test("path parameters can contain traversal sequences (by design - handlers must validate)", () => {
            const api = new FExpressMiddleware();

            // This test documents the behavior: traversal sequences pass through
            // Handlers using path params for file access MUST validate them
            const request = {
                path: "/api/files",
                pathParameters: { filepath: "../../../etc/passwd" },
                queryStringParameters: {},
                multiValueQueryStringParameters: {},
                httpMethod: FHttpMethod.GET,
                body: null,
                isBase64Encoded: false,
                headers: {},
                multiValueHeaders: {},
                originalRequestSource: "express",
                originalRequest: {},
                context: {},
                sourceIp: "127.0.0.1"
            };

            // Path parameter is returned as-is (after URL decoding)
            const filepath = api.pathParameter(request, "filepath");
            expect(filepath).toBe("../../../etc/passwd");
        });

        test("URL-encoded traversal sequences are decoded", () => {
            const api = new FExpressMiddleware();

            const request = {
                path: "/api/files",
                pathParameters: { filepath: "..%2F..%2F..%2Fetc%2Fpasswd" },
                queryStringParameters: {},
                multiValueQueryStringParameters: {},
                httpMethod: FHttpMethod.GET,
                body: null,
                isBase64Encoded: false,
                headers: {},
                multiValueHeaders: {},
                originalRequestSource: "express",
                originalRequest: {},
                context: {},
                sourceIp: "127.0.0.1"
            };

            // URL-encoded traversal is decoded
            const filepath = api.pathParameter(request, "filepath");
            expect(filepath).toBe("../../../etc/passwd");
        });
    });
});
