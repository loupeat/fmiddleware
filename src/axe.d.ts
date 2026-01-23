declare module "axe" {
    interface AxeOptions {
        name?: string;
        level?: string;
        meta?: {
            show?: boolean;
        };
        logger?: {
            log: (...args: any[]) => void;
            info: (...args: any[]) => void;
            warn: (...args: any[]) => void;
            error: (...args: any[]) => void;
            fatal: (...args: any[]) => void;
            debug: (...args: any[]) => void;
        };
    }

    class Axe {
        constructor(options?: AxeOptions);
        log(...args: any[]): void;
        info(...args: any[]): void;
        warn(...args: any[]): void;
        error(...args: any[]): void;
        fatal(...args: any[]): void;
        debug(...args: any[]): void;
    }

    export = Axe;
}
