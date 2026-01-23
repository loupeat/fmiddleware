import { FExpressMiddleware, FHttpMethod, FRequest, ValidationError } from "./index";

describe("FExpressMiddleware", () => {
    let api: FExpressMiddleware;

    beforeEach(() => {
        api = new FExpressMiddleware();
    });

    describe("Handler registration", () => {
        test("should register GET handler", () => {
            api.get("/api/test", async (request) => {
                return api.responses.OK(request, { message: "ok" });
            });

            expect(api.getHandlers().length).toBe(1);
            expect(api.getHandlers()[0].httpMethod).toBe(FHttpMethod.GET);
            expect(api.getHandlers()[0].pathPattern).toBe("/api/test");
        });

        test("should register POST handler", () => {
            api.post("/api/test", async (request) => {
                return api.responses.OK(request, { message: "ok" });
            });

            expect(api.getHandlers().length).toBe(1);
            expect(api.getHandlers()[0].httpMethod).toBe(FHttpMethod.POST);
        });

        test("should register PUT handler", () => {
            api.put("/api/test", async (request) => {
                return api.responses.OK(request, { message: "ok" });
            });

            expect(api.getHandlers().length).toBe(1);
            expect(api.getHandlers()[0].httpMethod).toBe(FHttpMethod.PUT);
        });

        test("should register DELETE handler", () => {
            api.delete("/api/test", async (request) => {
                return api.responses.OK(request, { message: "ok" });
            });

            expect(api.getHandlers().length).toBe(1);
            expect(api.getHandlers()[0].httpMethod).toBe(FHttpMethod.DELETE);
        });

        test("should register handler with schema", () => {
            const schema = {
                type: "object",
                properties: {
                    name: { type: "string" }
                },
                required: ["name"]
            };

            api.post("/api/test", async (request) => {
                return api.responses.OK(request, { message: "ok" });
            }, schema);

            expect(api.getHandlers()[0].schema).toEqual(schema);
        });
    });

    describe("Path prefix filtering", () => {
        test("should only register handlers matching path prefix", () => {
            api.setPathPrefix("/api/v1");

            api.get("/api/v1/users", async (request) => {
                return api.responses.OK(request, []);
            });

            api.get("/api/v2/users", async (request) => {
                return api.responses.OK(request, []);
            });

            expect(api.getHandlers().length).toBe(1);
            expect(api.getHandlers()[0].pathPattern).toBe("/api/v1/users");
        });
    });

    describe("Response helpers", () => {
        const mockRequest: FRequest<any, any> = {
            path: "/test",
            pathParameters: {},
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

        test("OK response should have status 200", () => {
            const response = api.responses.OK(mockRequest, { data: "test" });
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ data: "test" });
        });

        test("NoContent response should have status 204", () => {
            const response = api.responses.NoContent(mockRequest);
            expect(response.statusCode).toBe(204);
        });

        test("NotFound response should have status 404", () => {
            const response = api.responses.NotFound(mockRequest, "Resource not found");
            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({ message: "Resource not found" });
        });

        test("BadRequest response should have status 400", () => {
            const response = api.responses.BadRequest(mockRequest, "Invalid input");
            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({ message: "Invalid input" });
        });

        test("Custom status response using _ helper", () => {
            const response = api.responses._(mockRequest, 201, { id: "123" });
            expect(response.statusCode).toBe(201);
            expect(response.body).toEqual({ id: "123" });
        });
    });

    describe("Path parameter extraction", () => {
        test("should extract single path parameter", () => {
            const request: FRequest<any, any> = {
                path: "/api/users/123",
                pathParameters: { userId: "123" },
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

            expect(api.pathParameter(request, "userId")).toBe("123");
        });

        test("should throw ValidationError for missing path parameter", () => {
            const request: FRequest<any, any> = {
                path: "/api/users",
                pathParameters: {},
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

            expect(() => api.pathParameter(request, "userId")).toThrow(ValidationError);
        });

        test("should decode URL-encoded path parameters", () => {
            const request: FRequest<any, any> = {
                path: "/api/files/hello%20world.txt",
                pathParameters: { filename: "hello%20world.txt" },
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

            expect(api.pathParameter(request, "filename")).toBe("hello world.txt");
        });

        test("should throw ValidationError for malformed URL encoding", () => {
            const request: FRequest<any, any> = {
                path: "/api/files/bad%encoding",
                pathParameters: { filename: "%E0%A4%A" },
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

            expect(() => api.pathParameter(request, "filename")).toThrow(ValidationError);
            expect(() => api.pathParameter(request, "filename")).toThrow('Invalid URL encoding in parameter "filename"');
        });
    });

    describe("Query string parameters", () => {
        test("should return required query parameter", () => {
            const request: FRequest<any, any> = {
                path: "/api/search",
                pathParameters: {},
                queryStringParameters: { q: "test" },
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

            expect(api.queryStringParameter(request, "q")).toBe("test");
        });

        test("should throw for missing required query parameter", () => {
            const request: FRequest<any, any> = {
                path: "/api/search",
                pathParameters: {},
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

            expect(() => api.queryStringParameter(request, "q")).toThrow(ValidationError);
        });

        test("should return undefined for missing optional query parameter", () => {
            const request: FRequest<any, any> = {
                path: "/api/search",
                pathParameters: {},
                queryStringParameters: { q: "test" },
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

            expect(api.queryStringParameterOptional(request, "filter")).toBeUndefined();
        });
    });

    describe("Context", () => {
        test("should retrieve value from context", () => {
            const request: FRequest<any, any> = {
                path: "/api/test",
                pathParameters: {},
                queryStringParameters: {},
                multiValueQueryStringParameters: {},
                httpMethod: FHttpMethod.GET,
                body: null,
                isBase64Encoded: false,
                headers: {},
                multiValueHeaders: {},
                originalRequestSource: "express",
                originalRequest: {},
                context: { user: { id: "123", name: "Test User" } },
                sourceIp: "127.0.0.1"
            };

            const user = api.context<{ id: string; name: string }>(request, "user");
            expect(user.id).toBe("123");
            expect(user.name).toBe("Test User");
        });
    });
});
