import { APIGatewayProxyEvent } from "aws-lambda";
import { FAWSLambdaMiddleware } from "./aws-lambda-impl";
import { FExpressMiddleware } from "./express-impl";
import {
    AuthenticationError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError
} from "./types";

/**
 * Minimal Express-like request accepted by FExpressMiddleware.mapRequestType.
 */
function expressReq(method: string, path: string, body: any = {}): any {
    return { method, path, query: {}, headers: {}, ip: "127.0.0.1", body };
}

/**
 * Minimal APIGatewayProxyEvent for driving process() end to end.
 */
function lambdaEvent(method: string, path: string): APIGatewayProxyEvent {
    return {
        path,
        httpMethod: method,
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        body: null,
        isBase64Encoded: false,
        resource: "",
        requestContext: { identity: { sourceIp: "127.0.0.1" } } as any
    } as APIGatewayProxyEvent;
}

describe("process() request logging", () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "warn").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const infoLines = (): string[] => logSpy.mock.calls.map((call) => call.join(" "));
    const startLines = (): string[] => infoLines().filter((line) => line.includes("-->"));
    const endLines = (): string[] => infoLines().filter((line) => line.includes("<--"));

    test("emits one start and one end line at info by default", async () => {
        const api = new FExpressMiddleware();
        api.get("/api/notes/{id}", async (request) => api.responses.OK(request, { id: "42" }));

        await api.process(expressReq("GET", "/api/notes/42"));

        expect(startLines()).toHaveLength(1);
        expect(startLines()[0]).toContain("--> express GET   : /api/notes/42");
        expect(endLines()).toHaveLength(1);
        expect(endLines()[0]).toMatch(/<-- express GET\s+: \/api\/notes\/42 200 \d+ms/);
    });

    test("logs a start and end line for an unmatched route (404)", async () => {
        const api = new FExpressMiddleware();

        const response = await api.process(expressReq("GET", "/nope"));

        expect(response.statusCode).toBe(404);
        expect(startLines()).toHaveLength(1);
        expect(endLines()[0]).toMatch(/<-- express GET\s+: \/nope 404 \d+ms/);
    });

    test("requestLogging: 'off' emits no start/end lines", async () => {
        const api = new FExpressMiddleware({ requestLogging: "off" });
        api.get("/health", async (request) => api.responses.OK(request, { ok: true }));

        await api.process(expressReq("GET", "/health"));

        expect(startLines()).toHaveLength(0);
        expect(endLines()).toHaveLength(0);
    });

    test("requestLogging: 'debug' keeps start/end lines out of info output", async () => {
        const api = new FExpressMiddleware({ requestLogging: "debug" });
        api.get("/health", async (request) => api.responses.OK(request, { ok: true }));

        await api.process(expressReq("GET", "/health"));

        expect(startLines()).toHaveLength(0);
        expect(endLines()).toHaveLength(0);
    });
});

describe("process() hardening", () => {
    beforeEach(() => {
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "warn").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("a throw in path-parameter extraction returns a 500 instead of killing the invocation", async () => {
        const api = new FExpressMiddleware();
        // Duplicate placeholder makes Helper.extractPathParameters throw at request time.
        api.get("/x/{id}/{id}", async (request) => api.responses.OK(request, {}));

        const response = await api.process(expressReq("GET", "/x/1/2"));

        expect(response.statusCode).toBe(500);
    });

    test("a non-serialisable response body returns a 500 instead of killing the invocation", async () => {
        const api = new FAWSLambdaMiddleware();
        api.get("/circular", async (request) => {
            const circular: any = {};
            circular.self = circular;
            return api.responses.OK(request, circular);
        });

        const result = await api.process(lambdaEvent("GET", "/circular"));

        expect(result.statusCode).toBe(500);
    });

    test("a handler error still returns a 500 through the normal pipeline", async () => {
        const api = new FExpressMiddleware();
        api.get("/boom", async () => {
            throw new Error("kaboom");
        });

        const response = await api.process(expressReq("GET", "/boom"));

        expect(response.statusCode).toBe(500);
    });

    test("a missing requestContext.identity does not throw when mapping a Lambda event", () => {
        const api = new FAWSLambdaMiddleware();
        const event = lambdaEvent("GET", "/x");
        delete (event as any).requestContext;

        const request = api.mapRequestType(event);

        expect(request.sourceIp).toBe("unknown");
    });
});

describe("dispatch() error log levels", () => {
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "debug").mockImplementation(() => {});
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // The logger passes the `[WARN]`/`[ERROR]` prefix as the first argument, so the
    // message the call site wrote is the second and its extra arguments follow.
    const warnLines = (): string[] => warnSpy.mock.calls.map((call) => String(call[1]));
    const errorLines = (): string[] => errorSpy.mock.calls.map((call) => String(call[1]));

    /** Every class the error processor answers with a 4xx, and the status it maps to. */
    const clientErrors: [string, () => Error, number][] = [
        ["NotFoundError", () => new NotFoundError("no such note"), 404],
        ["ValidationError", () => new ValidationError("bad input"), 400],
        ["AuthenticationError", () => new AuthenticationError("not authenticated"), 401],
        ["ForbiddenError", () => new ForbiddenError("no permission"), 403],
        ["ConflictError", () => new ConflictError("already exists"), 409]
    ];

    test.each(clientErrors)("a handler throwing %s logs at warn, not error", async (_name, build, statusCode) => {
        const api = new FExpressMiddleware();
        api.get("/api/notes/{id}", async () => {
            throw build();
        });

        const response = await api.process(expressReq("GET", "/api/notes/42"));

        expect(response.statusCode).toBe(statusCode);
        expect(warnLines()).toHaveLength(1);
        expect(warnLines()[0]).toContain("Error in handler [GET]: /api/notes/{id}:");
        expect(errorLines()).toHaveLength(0);
    });

    test("a handler throwing a plain Error logs at error and answers 500", async () => {
        const api = new FExpressMiddleware();
        api.get("/boom", async () => {
            throw new Error("kaboom");
        });

        const response = await api.process(expressReq("GET", "/boom"));

        expect(response.statusCode).toBe(500);
        expect(errorLines()).toHaveLength(1);
        expect(errorLines()[0]).toContain("Error in handler [GET]: /boom:");
        expect(warnLines()).toHaveLength(0);
    });

    test("a subclass of a client error is classified by its base class", async () => {
        // Mirrors a consumer's per-entity denial class: still a 403, still expected.
        class EntityForbiddenError extends ForbiddenError {}
        const api = new FExpressMiddleware();
        api.get("/secret", async () => {
            throw new EntityForbiddenError("not yours");
        });

        const response = await api.process(expressReq("GET", "/secret"));

        expect(response.statusCode).toBe(403);
        expect(warnLines()).toHaveLength(1);
        expect(errorLines()).toHaveLength(0);
    });

    test("the error itself is still passed to the logger, not just the message", async () => {
        const api = new FExpressMiddleware();
        api.get("/api/notes/{id}", async () => {
            throw new NotFoundError("no such note");
        });

        await api.process(expressReq("GET", "/api/notes/42"));

        // Redaction hands the logger a clone, so the class is gone but the name and
        // message that reach the log are not.
        const logged = warnSpy.mock.calls[0][2] as Error;
        expect(logged).toBeInstanceOf(Error);
        expect(logged.name).toBe("NotFoundError");
        expect(logged.message).toBe("no such note");
    });

    test("a pre-processor throwing a client error logs at warn and answers its status", async () => {
        const api = new FExpressMiddleware();
        api.addRequestPreProcessor({
            name: "DenyingPreProcessor",
            pathPatterns: ["/**"],
            requestSource: "*",
            process: async () => {
                throw new ForbiddenError("no permission");
            }
        });
        api.get("/secret", async (request) => api.responses.OK(request, {}));

        const response = await api.process(expressReq("GET", "/secret"));

        expect(response.statusCode).toBe(403);
        expect(warnLines()).toHaveLength(1);
        expect(warnLines()[0]).toContain("Error in pre-processor DenyingPreProcessor:");
        expect(errorLines()).toHaveLength(0);
    });

    test("a pre-processor throwing a plain Error logs at error and answers 500", async () => {
        const api = new FExpressMiddleware();
        api.addRequestPreProcessor({
            name: "BrokenPreProcessor",
            pathPatterns: ["/**"],
            requestSource: "*",
            process: async () => {
                throw new Error("kaboom");
            }
        });
        api.get("/secret", async (request) => api.responses.OK(request, {}));

        const response = await api.process(expressReq("GET", "/secret"));

        expect(response.statusCode).toBe(500);
        expect(errorLines()).toHaveLength(1);
        expect(errorLines()[0]).toContain("Error in pre-processor BrokenPreProcessor:");
        expect(warnLines()).toHaveLength(0);
    });

    test("the process() backstop stays at error even for a client error class", async () => {
        // A throw in path-parameter extraction escapes dispatch, so no post-processor
        // can downgrade it — it is a 500 whatever class it carries.
        const api = new FExpressMiddleware();
        api.get("/x/{id}/{id}", async (request) => api.responses.OK(request, {}));

        const response = await api.process(expressReq("GET", "/x/1/2"));

        expect(response.statusCode).toBe(500);
        expect(errorLines().some((line) => line.includes("Unhandled error processing"))).toBe(true);
    });
});
