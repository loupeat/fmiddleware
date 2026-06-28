import { FMiddlewareDefaultValidationProcessor } from "./default-impl";
import { FRequest, ValidationError } from "./types";

function requestWithBody(body: any): FRequest<any, any> {
    return { body } as FRequest<any, any>;
}

describe("FMiddlewareDefaultValidationProcessor", () => {
    const objectSchema = {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"]
    };

    test("validates a body against a JSON Schema", async () => {
        await expect(
            FMiddlewareDefaultValidationProcessor.process(null as any, requestWithBody({ name: "ok" }), { schema: objectSchema } as any)
        ).resolves.toBeUndefined();
    });

    test("throws when a schema is attached but the body is missing", async () => {
        await expect(
            FMiddlewareDefaultValidationProcessor.process(null as any, requestWithBody(null), { schema: objectSchema } as any)
        ).rejects.toThrow(ValidationError);
    });

    test("does nothing when no schema is attached", async () => {
        await expect(
            FMiddlewareDefaultValidationProcessor.process(null as any, requestWithBody(null), {} as any)
        ).resolves.toBeUndefined();
    });

    describe("binary routes", () => {
        const binarySchema = { type: "binary" };

        test("skips validation for a binary Buffer body", async () => {
            await expect(
                FMiddlewareDefaultValidationProcessor.process(null as any, requestWithBody(Buffer.from([1, 2, 3])), { schema: binarySchema } as any)
            ).resolves.toBeUndefined();
        });

        test("allows an empty (zero-byte) binary body without throwing", async () => {
            await expect(
                FMiddlewareDefaultValidationProcessor.process(null as any, requestWithBody(Buffer.alloc(0)), { schema: binarySchema } as any)
            ).resolves.toBeUndefined();
        });

        test("allows a null binary body without throwing", async () => {
            await expect(
                FMiddlewareDefaultValidationProcessor.process(null as any, requestWithBody(null), { schema: binarySchema } as any)
            ).resolves.toBeUndefined();
        });
    });
});
