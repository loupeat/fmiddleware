import {
    ValidationError,
    NotFoundError,
    AuthenticationError,
    ForbiddenError,
    ConflictError,
    isClientError
} from "./index";

describe("Error Types", () => {
    describe("ValidationError", () => {
        test("should create error with message", () => {
            const error = new ValidationError("Invalid input");
            expect(error.message).toBe("Invalid input");
            expect(error.name).toBe("ValidationError");
            expect(error instanceof Error).toBe(true);
        });
    });

    describe("NotFoundError", () => {
        test("should create error with message", () => {
            const error = new NotFoundError("Resource not found");
            expect(error.message).toBe("Resource not found");
            expect(error.name).toBe("NotFoundError");
            expect(error instanceof Error).toBe(true);
        });
    });

    describe("AuthenticationError", () => {
        test("should create error with message", () => {
            const error = new AuthenticationError("Invalid token");
            expect(error.message).toBe("Invalid token");
            expect(error.name).toBe("AuthenticationError");
            expect(error instanceof Error).toBe(true);
        });
    });

    describe("ForbiddenError", () => {
        test("should create error with message", () => {
            const error = new ForbiddenError("Access denied");
            expect(error.message).toBe("Access denied");
            expect(error.name).toBe("ForbiddenError");
            expect(error instanceof Error).toBe(true);
        });
    });

    describe("ConflictError", () => {
        test("should create error with message", () => {
            const error = new ConflictError("Resource already exists");
            expect(error.message).toBe("Resource already exists");
            expect(error.name).toBe("ConflictError");
            expect(error instanceof Error).toBe(true);
        });
    });

    describe("Error inheritance", () => {
        test("errors should be catchable as Error", () => {
            const errors = [
                new ValidationError("test"),
                new NotFoundError("test"),
                new AuthenticationError("test"),
                new ForbiddenError("test"),
                new ConflictError("test")
            ];

            errors.forEach(error => {
                expect(() => { throw error; }).toThrow(Error);
            });
        });
    });

    describe("isClientError", () => {
        test("is true for every class the error processor maps to a 4xx", () => {
            const errors = [
                new ValidationError("test"),
                new NotFoundError("test"),
                new AuthenticationError("test"),
                new ForbiddenError("test"),
                new ConflictError("test")
            ];

            errors.forEach(error => {
                expect(isClientError(error)).toBe(true);
            });
        });

        test("is true for a subclass, which still maps to its base class's status", () => {
            class EntityForbiddenError extends ForbiddenError {}

            expect(isClientError(new EntityForbiddenError("test"))).toBe(true);
        });

        test("is false for a plain Error, which becomes a 500", () => {
            expect(isClientError(new Error("test"))).toBe(false);
            expect(isClientError(new TypeError("test"))).toBe(false);
        });

        test("is false for non-errors", () => {
            expect(isClientError(undefined)).toBe(false);
            expect(isClientError(null)).toBe(false);
            expect(isClientError("NotFoundError")).toBe(false);
            expect(isClientError({name: "NotFoundError"})).toBe(false);
        });
    });
});
