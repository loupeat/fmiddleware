import { FExpressMiddleware } from "./express-impl";

/**
 * Builds a minimal Express-like request for body-extraction tests.
 */
function request(overrides: Record<string, any>): any {
    return {
        path: "/api/test",
        method: "POST",
        headers: {},
        query: {},
        ip: "127.0.0.1",
        connection: { remoteAddress: "127.0.0.1" },
        body: undefined,
        ...overrides
    };
}

describe("FExpressMiddleware body extraction", () => {
    let api: FExpressMiddleware;

    beforeEach(() => {
        api = new FExpressMiddleware();
    });

    test("passes a JSON object (parsed by express.json) through unchanged", () => {
        const mapped = api.mapRequestType(request({
            headers: { "content-type": "application/json" },
            body: { name: "test" }
        }));
        expect(mapped.body).toEqual({ name: "test" });
    });

    describe("urlencoded bodies", () => {
        test("parses a raw urlencoded Buffer into a flat record", () => {
            const mapped = api.mapRequestType(request({
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: Buffer.from("From=%2B4312345&Body=hello+world")
            }));
            expect(mapped.body).toEqual({ From: "+4312345", Body: "hello world" });
        });

        test("passes an already-parsed urlencoded object (express.urlencoded) through", () => {
            const mapped = api.mapRequestType(request({
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: { a: "1", b: "2" }
            }));
            expect(mapped.body).toEqual({ a: "1", b: "2" });
        });
    });

    describe("binary bodies", () => {
        test("keeps a raw binary Buffer untouched", () => {
            const bytes = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
            const mapped = api.mapRequestType(request({
                headers: { "content-type": "application/octet-stream" },
                body: bytes
            }));
            expect(Buffer.isBuffer(mapped.body)).toBe(true);
            expect(Buffer.compare(mapped.body as Buffer, bytes)).toBe(0);
        });

        test("decodes a textual Buffer to a string", () => {
            const mapped = api.mapRequestType(request({
                headers: { "content-type": "text/plain" },
                body: Buffer.from("plain text")
            }));
            expect(mapped.body).toBe("plain text");
        });
    });
});
