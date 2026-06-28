import { FExpressMiddleware } from "../express-impl";
import { GeneratorConfig } from "./types";
import { OpenApiGenerator } from "./OpenApiGenerator";

const config: GeneratorConfig = {
    info: { title: "Test API", version: "1.0.0" }
};

function operation(api: FExpressMiddleware, pathKey: string, method: string): any {
    const spec = new OpenApiGenerator(api, config).generate();
    return spec.paths[pathKey][method];
}

describe("OpenApiGenerator request bodies", () => {
    let api: FExpressMiddleware;

    beforeEach(() => {
        api = new FExpressMiddleware();
    });

    test("defaults to application/json for a normal schema", () => {
        api.post("/api/notes", async (request) => api.responses.OK(request, {}), {
            type: "object",
            properties: { name: { type: "string" } }
        });

        const op = operation(api, "/api/notes", "post");
        expect(Object.keys(op.requestBody.content)).toEqual(["application/json"]);
        expect(op.requestBody.content["application/json"].schema.$ref).toMatch(/^#\/components\/schemas\//);
    });

    test("uses requestContentType for urlencoded routes", () => {
        api.post("/api/webhooks/twilio", async (request) => api.responses.OK(request, {}), {
            type: "object",
            properties: { CallSid: { type: "string" } }
        }, {
            requestContentType: "application/x-www-form-urlencoded"
        });

        const op = operation(api, "/api/webhooks/twilio", "post");
        expect(Object.keys(op.requestBody.content)).toEqual(["application/x-www-form-urlencoded"]);
        expect(op.requestBody.content["application/x-www-form-urlencoded"].schema.$ref).toMatch(/^#\/components\/schemas\//);
    });

    test("maps a binary schema to an octet-stream binary body", () => {
        api.put("/api/files/{id}", async (request) => api.responses.OK(request, {}), { type: "binary" });

        const op = operation(api, "/api/files/{id}", "put");
        expect(Object.keys(op.requestBody.content)).toEqual(["application/octet-stream"]);
        expect(op.requestBody.content["application/octet-stream"].schema).toEqual({ type: "string", format: "binary" });
    });

    test("honours a custom requestContentType for a binary schema", () => {
        api.put("/api/docs/{id}", async (request) => api.responses.OK(request, {}), { type: "binary" }, {
            requestContentType: "application/pdf"
        });

        const op = operation(api, "/api/docs/{id}", "put");
        expect(Object.keys(op.requestBody.content)).toEqual(["application/pdf"]);
        expect(op.requestBody.content["application/pdf"].schema).toEqual({ type: "string", format: "binary" });
    });
});
