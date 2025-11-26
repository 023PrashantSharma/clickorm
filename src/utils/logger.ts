/**
 * Structured logging utility for ClickORM
 * Provides consistent logging interface with multiple levels and colors
 */

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

/**
 * Helper functions for colored text
 */
const colorize = {
  gray: (text: string) => `${colors.gray}${text}${colors.reset}`,
  blue: (text: string) => `${colors.blue}${text}${colors.reset}`,
  green: (text: string) => `${colors.green}${text}${colors.reset}`,
  yellow: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  red: (text: string) => `${colors.red}${text}${colors.reset}`,
  cyan: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  magenta: (text: string) => `${colors.magenta}${text}${colors.reset}`,
  bold: (text: string) => `${colors.bright}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
};

/**
 * Log levels enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log level priorities for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enabled?: boolean;
  pretty?: boolean;
  output?: (entry: LogEntry) => void;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enabled: true,
  pretty: true,
};

/**
 * Logger class for structured logging
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) {
      return false;
    }
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Format log entry for output with colors
   */
  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';

    if (this.config.pretty) {
      const timeStr = colorize.gray(timestamp.toISOString());

      // Color-coded level badges
      let levelBadge: string;
      let messageColor: (text: string) => string;

      switch (level) {
        case LogLevel.DEBUG:
          levelBadge = colorize.dim(`[DEBUG]`);
          messageColor = colorize.dim;
          break;
        case LogLevel.INFO:
          levelBadge = colorize.blue(`[INFO] `);
          messageColor = (text) => text;
          break;
        case LogLevel.WARN:
          levelBadge = colorize.yellow(`[WARN] `);
          messageColor = colorize.yellow;
          break;
        case LogLevel.ERROR:
          levelBadge = colorize.red(`[ERROR]`);
          messageColor = colorize.red;
          break;
        default:
          levelBadge = `[${String(level).toUpperCase()}]`;
          messageColor = (text) => text;
      }

      const prefixStr = prefix ? colorize.cyan(prefix) : '';
      const parts = [`${timeStr} ${levelBadge} ${prefixStr} ${messageColor(message)}`];

      if (context && Object.keys(context).length > 0) {
        const contextStr = colorize.dim('Context:');
        parts.push(`  ${contextStr}`);

        // Format context with indentation and colors
        const contextLines = JSON.stringify(context, null, 2)
          .split('\n')
          .map((line) => `  ${colorize.dim(line)}`)
          .join('\n');
        parts.push(contextLines);
      }

      if (error) {
        parts.push(`  ${colorize.red('Error:')} ${colorize.bold(error.message)}`);
        if (error.stack) {
          const stackLines = error.stack
            .split('\n')
            .map((line) => `  ${colorize.dim(line)}`)
            .join('\n');
          parts.push(`  ${colorize.dim('Stack:')}\n${stackLines}`);
        }
      }

      return parts.join('\n');
    } else {
      // JSON format for structured logging
      return JSON.stringify({
        timestamp: timestamp.toISOString(),
        level,
        prefix: this.config.prefix,
        message,
        context,
        error: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
      });
    }
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (this.config.output) {
      this.config.output(entry);
    } else {
      const formatted = this.formatEntry(entry);
      switch (entry.level) {
        case LogLevel.DEBUG:
        case LogLevel.INFO:
          // eslint-disable-next-line no-console
          console.log(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.ERROR:
          console.error(formatted);
          break;
      }
    }
  }

  /**
   * Log a message at the specified level
   */
  log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
    };

    this.output(entry);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    const childPrefix = this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix;
    return new Logger({ ...this.config, prefix: childPrefix });
  }

  /**
   * Log query execution (specialized method)
   */
  logQuery(query: string, params?: unknown[], duration?: number): void {
    this.debug('Query executed', {
      query,
      params,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  /**
   * Log connection event (specialized method)
   */
  logConnection(
    event: 'connect' | 'disconnect' | 'error',
    details?: Record<string, unknown>
  ): void {
    const level = event === 'error' ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `Database ${event}`, details);
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger({
  level:
    typeof process !== 'undefined' && process.env['LOG_LEVEL']
      ? (process.env['LOG_LEVEL'].toLowerCase() as LogLevel)
      : LogLevel.INFO,
  prefix: 'ClickORM',
});

/**
 * Create a custom logger instance
 */
export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  return new Logger(config);
}

/**
 * Convenience functions using default logger
 */
export const debug = (message: string, context?: Record<string, unknown>): void => {
  defaultLogger.debug(message, context);
};

export const info = (message: string, context?: Record<string, unknown>): void => {
  defaultLogger.info(message, context);
};

export const warn = (message: string, context?: Record<string, unknown>): void => {
  defaultLogger.warn(message, context);
};

export const error = (message: string, err?: Error, context?: Record<string, unknown>): void => {
  defaultLogger.error(message, err, context);
};
