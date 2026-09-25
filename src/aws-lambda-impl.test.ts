import { APIGatewayProxyEvent } from "aws-lambda";
import { FAWSLambdaMiddleware } from "./aws-lambda-impl";
import { FResponse } from "./types";

/**
 * Builds a minimal APIGatewayProxyEvent for body-extraction tests.
 */
function event(overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
    return {
        path: "/api/test",
        httpMethod: "POST",
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        body: null,
        isBase64Encoded: false,
        resource: "",
        requestContext: { identity: { sourceIp: "127.0.0.1" } } as any,
        ...overrides
    } as APIGatewayProxyEvent;
}

describe("FAWSLambdaMiddleware body extraction", () => {
    let api: FAWSLambdaMiddleware;

    beforeEach(() => {
        api = new FAWSLambdaMiddleware();
    });

    describe("JSON bodies", () => {
        test("parses a JSON object", () => {
            const request = api.mapRequestType(event({
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: "test" })
            }));
            expect(request.body).toEqual({ name: "test" });
        });

        test("falls back to the raw string on invalid JSON", () => {
            const request = api.mapRequestType(event({
                headers: { "content-type": "application/json" },
                body: "not json"
            }));
            expect(request.body).toBe("not json");
        });

        test("decodes base64-encoded JSON bodies", () => {
            const request = api.mapRequestType(event({
                headers: { "content-type": "application/json" },
                body: Buffer.from(JSON.stringify({ a: 1 })).toString("base64"),
                isBase64Encoded: true
            }));
            expect(request.body).toEqual({ a: 1 });
        });
    });

    describe("urlencoded bodies", () => {
        test("parses an urlencoded body into a flat record", () => {
            const request = api.mapRequestType(event({
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: "From=%2B4312345&To=%2B4399999&CallSid=CA123"
            }));
            expect(request.body).toEqual({ From: "+4312345", To: "+4399999", CallSid: "CA123" });
        });

        test("tolerates a charset parameter", () => {
            const request = api.mapRequestType(event({
                headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
                body: "a=1&b=2"
            }));
            expect(request.body).toEqual({ a: "1", b: "2" });
        });

        test("decodes base64-encoded urlencoded bodies", () => {
            const request = api.mapRequestType(event({
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: Buffer.from("a=1&b=2").toString("base64"),
                isBase64Encoded: true
            }));
            expect(request.body).toEqual({ a: "1", b: "2" });
        });

        test("yields an empty record for an empty body", () => {
            const request = api.mapRequestType(event({
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: ""
            }));
            expect(request.body).toEqual({});
        });
    });

    describe("binary bodies", () => {
        test("exposes a base64 binary body as a faithful Buffer", () => {
            const bytes = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
            const request = api.mapRequestType(event({
                headers: { "content-type": "application/octet-stream" },
                body: bytes.toString("base64"),
                isBase64Encoded: true
            }));
            expect(Buffer.isBuffer(request.body)).toBe(true);
            expect(Buffer.compare(request.body as Buffer, bytes)).toBe(0);
        });

        test("exposes a zero-byte binary body as an empty Buffer", () => {
            const request = api.mapRequestType(event({
                headers: { "content-type": "application/octet-stream" },
                body: "",
                isBase64Encoded: true
            }));
            expect(Buffer.isBuffer(request.body)).toBe(true);
            expect((request.body as Buffer).length).toBe(0);
        });
    });
});

describe("FAWSLambdaMiddleware response mapping", () => {
    let api: FAWSLambdaMiddleware;

    beforeEach(() => {
        api = new FAWSLambdaMiddleware();
    });

    function response(body: any): FResponse<APIGatewayProxyEvent, any, any> {
        return {
            statusCode: 200,
            body,
            headers: {},
            multiValueHeaders: {},
            isBase64Encoded: false,
            request: {} as any
        };
    }

    test("serializes a JSON body compactly", () => {
        const data = { items: [{ id: 1, name: "a" }, { id: 2, tags: ["x", "y"] }], nested: { ok: true } };
        const result = api.mapResponseType(response(data));
        expect(result.body).toBe(JSON.stringify(data));
        expect(result.body).not.toMatch(/\n/);
        expect(JSON.parse(result.body)).toEqual(data);
        expect(result.isBase64Encoded).toBe(false);
    });

    test("keeps newlines that are part of the data", () => {
        const data = { text: "line1\nline2" };
        const result = api.mapResponseType(response(data));
        expect(JSON.parse(result.body)).toEqual(data);
    });

    test("passes a string body through unchanged", () => {
        const result = api.mapResponseType(response("<p>\n  hello\n</p>"));
        expect(result.body).toBe("<p>\n  hello\n</p>");
        expect(result.isBase64Encoded).toBe(false);
    });

    test("base64-encodes a Buffer body", () => {
        const bytes = Buffer.from([0x00, 0xff, 0x10, 0x80]);
        const result = api.mapResponseType(response(bytes));
        expect(result.body).toBe(bytes.toString("base64"));
        expect(result.isBase64Encoded).toBe(true);
    });

    test("yields an empty string for a null body", () => {
        expect(api.mapResponseType(response(null)).body).toBe("");
        expect(api.mapResponseType(response(undefined)).body).toBe("");
    });
});
