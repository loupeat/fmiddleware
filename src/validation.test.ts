import { validator, ValidationError } from "./index";

describe("Validator", () => {
    describe("UUID validation", () => {
        test("valid UUID should pass", () => {
            expect(() => validator.validateUuid("550e8400-e29b-41d4-a716-446655440000")).not.toThrow();
        });

        test("invalid UUID should throw ValidationError", () => {
            expect(() => validator.validateUuid("not-a-uuid")).toThrow(ValidationError);
            expect(() => validator.validateUuid("not-a-uuid")).toThrow("Invalid UUID: not-a-uuid");
        });

        test("UUID with wrong format should throw", () => {
            expect(() => validator.validateUuid("550e8400e29b41d4a716446655440000")).toThrow(ValidationError);
        });
    });

    describe("Schema validation with custom keywords", () => {
        test("uuid keyword should validate UUIDs in schema", () => {
            const schema = {
                type: "object",
                properties: {
                    id: { type: "string", uuid: true }
                },
                required: ["id"]
            };

            expect(() => validator.validate(schema, { id: "550e8400-e29b-41d4-a716-446655440000" })).not.toThrow();
            expect(() => validator.validate(schema, { id: "invalid" })).toThrow(ValidationError);
        });

        test("email keyword should validate emails in schema", () => {
            const schema = {
                type: "object",
                properties: {
                    email: { type: "string", email: true }
                },
                required: ["email"]
            };

            expect(() => validator.validate(schema, { email: "test@example.com" })).not.toThrow();
            expect(() => validator.validate(schema, { email: "invalid-email" })).toThrow(ValidationError);
        });

        test("json keyword should validate JSON strings in schema", () => {
            const schema = {
                type: "object",
                properties: {
                    data: { type: "string", json: true }
                },
                required: ["data"]
            };

            expect(() => validator.validate(schema, { data: '{"key": "value"}' })).not.toThrow();
            expect(() => validator.validate(schema, { data: "not json" })).toThrow(ValidationError);
        });
    });

    describe("Email validation edge cases", () => {
        const emailSchema = {
            type: "object",
            properties: {
                email: { type: "string", email: true }
            },
            required: ["email"]
        };

        test("valid emails should pass", () => {
            const validEmails = [
                "test@example.com",
                "user.name@domain.co.uk",
                "user+tag@example.org",
                "a@b.cc"
            ];

            validEmails.forEach(email => {
                expect(() => validator.validate(emailSchema, { email })).not.toThrow();
            });
        });

        test("invalid emails should fail", () => {
            const invalidEmails = [
                "notanemail",
                "@nodomain.com",
                "no@tld",
                "spaces in@email.com"
            ];

            invalidEmails.forEach(email => {
                expect(() => validator.validate(emailSchema, { email })).toThrow(ValidationError);
            });
        });
    });
});
