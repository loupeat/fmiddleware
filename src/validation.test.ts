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

    describe("Date validation", () => {
        const schema = {
            type: "object",
            properties: { d: { type: "string", date: true } },
            required: ["d"]
        };

        test("valid dates should pass", () => {
            for (const d of ["2024-01-15", "2000-12-31", "1999-01-01"]) {
                expect(() => validator.validate(schema, { d })).not.toThrow();
            }
        });

        test("invalid dates should fail", () => {
            for (const d of ["2024-13-01", "2024-00-01", "2024-01-32", "2024/01/15", "01-15-2024", "not-a-date"]) {
                expect(() => validator.validate(schema, { d })).toThrow(ValidationError);
            }
        });
    });

    describe("Time validation", () => {
        const schema = {
            type: "object",
            properties: { t: { type: "string", time: true } },
            required: ["t"]
        };

        test("valid times should pass", () => {
            for (const t of ["10:30:00", "00:00:00", "23:59:59", "10:30:00.123", "10:30:00.123456"]) {
                expect(() => validator.validate(schema, { t })).not.toThrow();
            }
        });

        test("invalid times should fail", () => {
            for (const t of ["24:00:00", "10:60:00", "10:30:60", "10:30", "not-a-time"]) {
                expect(() => validator.validate(schema, { t })).toThrow(ValidationError);
            }
        });
    });

    describe("Datetime validation with true", () => {
        const schema = {
            type: "object",
            properties: { dt: { type: "string", datetime: true } },
            required: ["dt"]
        };

        test("valid datetimes should pass", () => {
            for (const dt of [
                "2024-01-15T10:30:00Z",
                "2024-01-15T10:30:00.123Z",
                "2024-01-15T10:30:00+02:00",
                "2024-01-15T10:30:00-05:30",
                "2024-01-15T10:30:00.999+00:00"
            ]) {
                expect(() => validator.validate(schema, { dt })).not.toThrow();
            }
        });

        test("invalid datetimes should fail", () => {
            for (const dt of ["2024-01-15", "10:30:00", "2024-01-15 10:30:00", "not-a-datetime"]) {
                expect(() => validator.validate(schema, { dt })).toThrow(ValidationError);
            }
        });
    });

    describe("Datetime validation with zulu", () => {
        const schema = {
            type: "object",
            properties: { dt: { type: "string", datetime: "zulu" } },
            required: ["dt"]
        };

        test("valid Zulu datetimes should pass", () => {
            for (const dt of ["2024-01-15T10:30:00Z", "2024-01-15T10:30:00.123Z"]) {
                expect(() => validator.validate(schema, { dt })).not.toThrow();
            }
        });

        test("offset datetimes should fail", () => {
            for (const dt of ["2024-01-15T10:30:00+02:00", "2024-01-15T10:30:00-05:30"]) {
                expect(() => validator.validate(schema, { dt })).toThrow(ValidationError);
            }
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
