import { isBinary, isUrlEncoded, normalizedContentType, parseUrlEncoded } from "./content-type";

describe("content-type helpers", () => {
    describe("normalizedContentType", () => {
        test("returns undefined for missing headers", () => {
            expect(normalizedContentType(undefined)).toBeUndefined();
            expect(normalizedContentType(null)).toBeUndefined();
            expect(normalizedContentType({})).toBeUndefined();
        });

        test("is case-insensitive on the header name", () => {
            expect(normalizedContentType({ "Content-Type": "application/json" })).toBe("application/json");
            expect(normalizedContentType({ "CONTENT-TYPE": "application/json" })).toBe("application/json");
        });

        test("strips charset and other parameters and lower-cases the value", () => {
            expect(normalizedContentType({ "content-type": "Application/JSON; charset=utf-8" })).toBe("application/json");
            expect(normalizedContentType({ "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }))
                .toBe("application/x-www-form-urlencoded");
        });
    });

    describe("isUrlEncoded", () => {
        test("matches only the urlencoded media type", () => {
            expect(isUrlEncoded("application/x-www-form-urlencoded")).toBe(true);
            expect(isUrlEncoded("application/json")).toBe(false);
            expect(isUrlEncoded(undefined)).toBe(false);
        });
    });

    describe("isBinary", () => {
        test("treats octet-stream and other non-text types as binary", () => {
            expect(isBinary("application/octet-stream")).toBe(true);
            expect(isBinary("application/pdf")).toBe(true);
            expect(isBinary("image/png")).toBe(true);
        });

        test("does not treat json, urlencoded, text or missing types as binary", () => {
            expect(isBinary("application/json")).toBe(false);
            expect(isBinary("application/vnd.api+json")).toBe(false);
            expect(isBinary("application/x-www-form-urlencoded")).toBe(false);
            expect(isBinary("text/plain")).toBe(false);
            expect(isBinary(undefined)).toBe(false);
        });
    });

    describe("parseUrlEncoded", () => {
        test("parses a flat record", () => {
            expect(parseUrlEncoded("a=1&b=2")).toEqual({ a: "1", b: "2" });
        });

        test("percent-decodes and turns + into space", () => {
            expect(parseUrlEncoded("From=%2B4312345&Body=hello+world")).toEqual({
                From: "+4312345",
                Body: "hello world"
            });
        });

        test("collapses repeated keys to last-wins", () => {
            expect(parseUrlEncoded("a=1&a=2")).toEqual({ a: "2" });
        });

        test("yields an empty record for an empty body", () => {
            expect(parseUrlEncoded("")).toEqual({});
        });
    });
});
