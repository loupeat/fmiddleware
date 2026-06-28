/**
 * Helpers for content-type based request body handling.
 *
 * Body extraction happens before the handler (and therefore its schema) is known,
 * so the only thing the runtime impls can key off is the request `Content-Type`
 * header. These helpers keep that detection identical across the AWS Lambda and
 * Express implementations.
 */

/**
 * Returns the normalized (lower-cased, parameter-stripped) content type from a
 * header map, doing a case-insensitive lookup of the `content-type` header.
 *
 * `application/json; charset=utf-8` becomes `application/json`.
 */
export function normalizedContentType(headers?: Record<string, string | undefined> | null): string | undefined {
    if (!headers) {
        return undefined;
    }
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === "content-type") {
            const value = headers[key];
            if (typeof value !== "string") {
                return undefined;
            }
            const semicolon = value.indexOf(";");
            const base = semicolon === -1 ? value : value.slice(0, semicolon);
            return base.trim().toLowerCase();
        }
    }
    return undefined;
}

/**
 * Whether the given content type denotes a form-urlencoded body.
 */
export function isUrlEncoded(contentType?: string): boolean {
    return contentType === "application/x-www-form-urlencoded";
}

/**
 * Whether the given content type should be treated as a binary/passthrough body.
 *
 * Anything that is not JSON, not form-urlencoded and not textual is considered
 * binary (e.g. `application/octet-stream`, `application/pdf`, `image/*`).
 * A missing content type is not treated as binary so the existing JSON-with-raw
 * -fallback behaviour is preserved for callers that omit the header.
 */
export function isBinary(contentType?: string): boolean {
    if (!contentType) {
        return false;
    }
    if (isUrlEncoded(contentType)) {
        return false;
    }
    if (contentType === "application/json" || contentType.endsWith("+json")) {
        return false;
    }
    if (contentType.startsWith("text/")) {
        return false;
    }
    return true;
}

/**
 * Parses a form-urlencoded body into a flat record.
 *
 * Uses `URLSearchParams`, so percent-encoding and `+` → space are handled.
 * Repeated keys collapse to last-wins; an empty body yields `{}`.
 */
export function parseUrlEncoded(raw: string): Record<string, string> {
    const params = new URLSearchParams(raw);
    const result: Record<string, string> = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}
