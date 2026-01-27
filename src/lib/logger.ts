/**
 * Centralized Logging Utility
 * 
 * Allows toggling console logs via localStorage.setItem('alb_debug', 'true')
 * Hierarchy: DEBUG < INFO < WARN < ERROR < NONE
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';

const LOG_LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
};

class Logger {
    private prefix = '[ALBUM]';

    private get currentLevel(): number {
        if (typeof window === 'undefined') return LOG_LEVELS.INFO;

        const isDebug = localStorage.getItem('alb_debug') === 'true';
        return isDebug ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= this.currentLevel;
    }

    debug(...args: any[]) {
        if (this.shouldLog('DEBUG')) {
            console.debug(this.prefix, ...args);
        }
    }

    info(...args: any[]) {
        if (this.shouldLog('INFO')) {
            console.info(this.prefix, ...args);
        }
    }

    warn(...args: any[]) {
        if (this.shouldLog('WARN')) {
            console.warn(this.prefix, ...args);
        }
    }

    error(...args: any[]) {
        if (this.shouldLog('ERROR')) {
            console.error(this.prefix, ...args);
        }
    }
}

export const logger = new Logger();
export default logger;
