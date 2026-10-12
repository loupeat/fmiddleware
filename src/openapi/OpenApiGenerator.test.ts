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

describe("OpenApiGenerator custom keywords", () => {
    test("leaves plainText out of the spec without touching the route schema", () => {
        const api = new FExpressMiddleware();
        const schema = {
            type: "object",
            properties: {
                name: { type: "string", plainText: true },
                message: { type: ["string", "null"], plainText: true },
                id: { type: "string", uuid: true },
                contact: {
                    type: "object",
                    properties: { company: { type: "string", plainText: true } }
                },
                tags: { type: "array", items: { type: "string", plainText: true } }
            }
        };
        api.post("/api/contacts", async (request) => api.responses.OK(request, {}), schema);

        const spec = new OpenApiGenerator(api, config).generate();

        expect(JSON.stringify(spec)).not.toContain("plainText");
        const generated: any = Object.values(spec.components!.schemas!)
            .find((s: any) => s.properties?.contact);
        expect(generated.properties.name).toEqual({ type: "string" });
        expect(generated.properties.id).toEqual({ type: "string", format: "uuid" });

        // The validator compiles the same object, so the keywords must survive.
        expect(schema.properties.name).toEqual({ type: "string", plainText: true });
        expect(schema.properties.id).toEqual({ type: "string", uuid: true });
        expect(schema.properties.contact.properties.company.plainText).toBe(true);
    });
});
