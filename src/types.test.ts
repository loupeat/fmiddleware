import {
    ValidationError,
    NotFoundError,
    AuthenticationError,
    ForbiddenError,
    ConflictError
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
});
