import Axe from "axe";
import chalk from "chalk";

/**
 * A single redaction rule. Every match of `pattern` in a log message is
 * replaced with `replacement` before the message reaches the underlying
 * logger. Use a global (`/g`) pattern to replace every occurrence, not just
 * the first.
 */
export interface LogRedactor {
    pattern: RegExp;
    replacement: string;
}

/**
 * Opt-in redactor for e-mail addresses. Not part of {@link defaultLogRedactors}
 * because e-mails are frequently useful for debugging and low-sensitivity — add
 * it explicitly when your logs must not carry them:
 * `setLogRedactors([...defaultLogRedactors, emailRedactor])`.
 */
export const emailRedactor: LogRedactor =
    {pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: "[EMAIL]"};

/**
 * Sensible default redactors, active out of the box. They scrub the
 * high-confidence secrets that have no legitimate reason to reach CloudWatch:
 * bearer tokens, bare JWTs and IBANs.
 *
 * Replace them wholesale with {@link setLogRedactors}, extend them with
 * {@link addLogRedactors} (or {@link emailRedactor}), or turn redaction off
 * entirely with `setLogRedactors([])`.
 */
export const defaultLogRedactors: LogRedactor[] = [
    // `Authorization: Bearer <token>` — opaque or JWT-shaped. Runs before the
    // bare-JWT rule so a bearer JWT collapses to `Bearer [REDACTED]`.
    {pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: "Bearer [REDACTED]"},
    // Bare JWTs (header segment always starts with `eyJ`, i.e. base64 of `{"`).
    {pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: "[JWT]"},
    // IBANs — two letters, two check digits, then 10-30 alphanumerics.
    {pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, replacement: "[IBAN]"}
];

let activeRedactors: LogRedactor[] = [...defaultLogRedactors];

/**
 * Replaces the active redactor set entirely. Pass `[]` to disable redaction,
 * or spread {@link defaultLogRedactors} to keep the built-ins while adding your
 * own: `setLogRedactors([...defaultLogRedactors, myRule])`.
 */
export function setLogRedactors(redactors: LogRedactor[]): void {
    activeRedactors = [...redactors];
}

/**
 * Appends redactors to the active set, keeping the ones already configured.
 */
export function addLogRedactors(...redactors: LogRedactor[]): void {
    activeRedactors = [...activeRedactors, ...redactors];
}

/**
 * Returns a copy of the currently active redactor set.
 */
export function getLogRedactors(): LogRedactor[] {
    return [...activeRedactors];
}

function redactString(value: string): string {
    let result = value;
    for (const {pattern, replacement} of activeRedactors) {
        // `String.prototype.replace` resets a global regex's `lastIndex`, so
        // reusing the same RegExp instance across calls is safe.
        result = result.replace(pattern, replacement);
    }
    return result;
}

function redactValue(value: any, seen: WeakSet<object>): any {
    if (typeof value === "string") {
        return redactString(value);
    }
    if (value instanceof Error) {
        // Never mutate the caller's error — clone it with scrubbed message and
        // stack so the original object keeps its data for any other handler.
        const clone = new Error(redactString(value.message));
        clone.name = value.name;
        if (value.stack) {
            clone.stack = redactString(value.stack);
        }
        return clone;
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) {
            return value;
        }
        seen.add(value);
        return value.map((element) => redactValue(element, seen));
    }
    if (value && typeof value === "object") {
        if (seen.has(value)) {
            return value;
        }
        seen.add(value);
        const result: Record<string, any> = {};
        for (const key of Object.keys(value)) {
            result[key] = redactValue(value[key], seen);
        }
        return result;
    }
    return value;
}

/**
 * Applies the active redactors to a value and returns a scrubbed copy. Strings
 * are rewritten in place, `Error`s are cloned with scrubbed message and stack,
 * and other objects are deep-copied with their string leaves scrubbed. Numbers,
 * booleans and other primitives pass through unchanged.
 *
 * Redaction must never break logging, so any unexpected failure falls back to
 * returning the value untouched.
 */
export function redact<T>(value: T): T {
    if (activeRedactors.length === 0) {
        return value;
    }
    try {
        return redactValue(value, new WeakSet<object>()) as T;
    } catch {
        return value;
    }
}

function redactArgs(args: any[]): any[] {
    if (activeRedactors.length === 0) {
        return args;
    }
    try {
        const seen = new WeakSet<object>();
        return args.map((arg) => redactValue(arg, seen));
    } catch {
        return args;
    }
}

const customLogger = {
    log: (...args: any[]) => {
        console.log('[INFO] ', ...redactArgs(args));
    },
    info: (...args: any[]) => {
        console.log('[INFO] ', ...redactArgs(args));
    },
    warn: (...args: any[]) => {
        console.warn(chalk.yellow('[WARN] '), ...redactArgs(args));
    },
    error: (...args: any[]) => {
        console.error(chalk.red('[ERROR]'), ...redactArgs(args));
    },
    fatal: (...args: any[]) => {
        console.error(chalk.bgRed.white.bold('[FATAL]'), ...redactArgs(args));
    },
    debug: (...args: any[]) => {
        console.debug('[DEBUG]', ...redactArgs(args));
    },
};

function getLogLevel(): string {
    return process.env.LOG_LEVEL || "info";
}

export const logger = new Axe({
    name: "fmiddleware",
    level: getLogLevel(),
    meta: {
        show: false
    },
    logger: customLogger
});
