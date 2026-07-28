import {
    logger,
    redact,
    defaultLogRedactors,
    emailRedactor,
    setLogRedactors,
    addLogRedactors,
    getLogRedactors,
    LogRedactor
} from "./logger";
import { FAWSLambdaMiddleware } from "./aws-lambda-impl";

const IBAN = "AT611904300234573201";
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123DEF456-_x";

describe("log redaction", () => {
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        setLogRedactors(defaultLogRedactors);
        logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(console, "warn").mockImplementation(() => {});
        jest.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        setLogRedactors(defaultLogRedactors);
    });

    const lastLine = (spy: jest.SpyInstance): string => spy.mock.calls[spy.mock.calls.length - 1].join(" ");

    describe("default redactors", () => {
        test("redacts IBANs", () => {
            logger.info(`Transfer to ${IBAN} completed`);
            expect(lastLine(logSpy)).toContain("[IBAN]");
            expect(lastLine(logSpy)).not.toContain(IBAN);
        });

        test("does not redact e-mail addresses", () => {
            logger.info("submitter john.doe@example.com filed a report");
            expect(lastLine(logSpy)).toContain("john.doe@example.com");
            expect(lastLine(logSpy)).not.toContain("[EMAIL]");
        });

        test("redacts bearer tokens", () => {
            logger.info("Authorization: Bearer abc.def.ghi123XYZ");
            expect(lastLine(logSpy)).toContain("Bearer [REDACTED]");
            expect(lastLine(logSpy)).not.toContain("abc.def.ghi123XYZ");
        });

        test("redacts bare JWTs", () => {
            logger.info(`token=${JWT}`);
            expect(lastLine(logSpy)).toContain("[JWT]");
            expect(lastLine(logSpy)).not.toContain(JWT);
        });

        test("collapses a bearer JWT to a single marker", () => {
            logger.info(`Bearer ${JWT}`);
            expect(lastLine(logSpy)).toContain("Bearer [REDACTED]");
            expect(lastLine(logSpy)).not.toContain("[JWT]");
        });

        test("leaves non-sensitive text untouched", () => {
            logger.info("GET   : /health served in 3ms");
            expect(lastLine(logSpy)).toContain("GET   : /health served in 3ms");
        });
    });

    describe("Error arguments", () => {
        test("scrubs the message and stack of a logged Error without mutating the original", () => {
            const err = new Error(`lookup failed for ${IBAN}`);
            logger.error("Error in handler:", err);

            // The caller's Error keeps its original data.
            expect(err.message).toContain(IBAN);

            const emitted = errorSpy.mock.calls[errorSpy.mock.calls.length - 1]
                .find((arg: unknown) => arg instanceof Error) as Error;
            expect(emitted).toBeDefined();
            expect(emitted).not.toBe(err);
            expect(emitted.message).toContain("[IBAN]");
            expect(emitted.message).not.toContain(IBAN);
            expect(emitted.stack).not.toContain(IBAN);
        });
    });

    describe("redact()", () => {
        test("rewrites string leaves inside nested objects and arrays", () => {
            const scrubbed = redact({
                token: "Bearer abc.def.ghi",
                accounts: [IBAN, "not-sensitive"]
            });
            expect(scrubbed).toEqual({
                token: "Bearer [REDACTED]",
                accounts: ["[IBAN]", "not-sensitive"]
            });
        });

        test("passes primitives through unchanged", () => {
            expect(redact(42)).toBe(42);
            expect(redact(true)).toBe(true);
            expect(redact(null)).toBeNull();
        });

        test("tolerates circular references", () => {
            const cyclic: any = { iban: IBAN };
            cyclic.self = cyclic;
            const scrubbed = redact(cyclic);
            expect(scrubbed.iban).toBe("[IBAN]");
        });

        test("is a no-op when no redactors are configured", () => {
            setLogRedactors([]);
            expect(redact(`iban ${IBAN}`)).toBe(`iban ${IBAN}`);
        });
    });

    describe("emailRedactor (opt-in)", () => {
        test("scrubs e-mail addresses once added to the active set", () => {
            setLogRedactors([...defaultLogRedactors, emailRedactor]);
            logger.info("submitter john.doe@example.com filed a report");
            expect(lastLine(logSpy)).toContain("[EMAIL]");
            expect(lastLine(logSpy)).not.toContain("john.doe@example.com");
        });
    });

    describe("configuration", () => {
        test("setLogRedactors replaces the active set", () => {
            setLogRedactors([{ pattern: /secret/g, replacement: "[X]" }]);
            expect(getLogRedactors()).toHaveLength(1);
            logger.info("this is a secret value");
            expect(lastLine(logSpy)).toContain("[X]");
            // Defaults no longer apply.
            logger.info(`iban ${IBAN}`);
            expect(lastLine(logSpy)).toContain(IBAN);
        });

        test("setLogRedactors([]) disables redaction", () => {
            setLogRedactors([]);
            logger.info(`iban ${IBAN}`);
            expect(lastLine(logSpy)).toContain(IBAN);
        });

        test("addLogRedactors extends the active set", () => {
            const before = getLogRedactors().length;
            addLogRedactors({ pattern: /widget-\d+/g, replacement: "[WIDGET]" });
            expect(getLogRedactors()).toHaveLength(before + 1);
            logger.info(`order widget-42 for ${IBAN}`);
            expect(lastLine(logSpy)).toContain("[WIDGET]");
            expect(lastLine(logSpy)).toContain("[IBAN]");
        });
    });

    describe("constructor wiring", () => {
        test("the redact option replaces the active redactors", () => {
            const custom: LogRedactor[] = [{ pattern: /token-\w+/g, replacement: "[TOKEN]" }];
            new FAWSLambdaMiddleware({ redact: custom });
            expect(getLogRedactors()).toHaveLength(1);
            logger.info("received token-abc123");
            expect(lastLine(logSpy)).toContain("[TOKEN]");
            expect(lastLine(logSpy)).not.toContain("token-abc123");
        });
    });
});
