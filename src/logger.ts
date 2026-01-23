import Axe from "axe";
import chalk from "chalk";

const customLogger = {
    log: (...args: any[]) => {
        console.log('[INFO] ', ...args);
    },
    info: (...args: any[]) => {
        console.log('[INFO] ', ...args);
    },
    warn: (...args: any[]) => {
        console.warn(chalk.yellow('[WARN] '), ...args);
    },
    error: (...args: any[]) => {
        console.error(chalk.red('[ERROR]'), ...args);
    },
    fatal: (...args: any[]) => {
        console.error(chalk.bgRed.white.bold('[FATAL]'), ...args);
    },
    debug: (...args: any[]) => {
        console.debug('[DEBUG]', ...args);
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
