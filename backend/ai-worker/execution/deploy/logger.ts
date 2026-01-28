#!/usr/bin/env node

/**
 * Simple structured logger for deployment and validation scripts
 *
 * This logger outputs diagnostic messages to stderr while preserving stdout
 * for structured data outputs (JSON, final results, etc.)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  prefix?: string;
  message: string;
  data?: Record<string, unknown>;
}

class DeploymentLogger {
  private minLogLevel: LogLevel = 'info';
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(minLogLevel?: LogLevel) {
    if (minLogLevel) {
      this.minLogLevel = minLogLevel;
    }
  }

  /**
   * Format a log entry as structured JSON
   */
  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, prefix, message, data } = entry;
    const levelUpper = level.toUpperCase();
    const prefixStr = prefix ? `[${prefix}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';

    return `${timestamp} ${levelUpper} ${prefixStr} ${message}${dataStr}`;
  }

  /**
   * Determine if a message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLogLevel];
  }

  /**
   * Internal method to log a message
   */
  private log(level: LogLevel, prefix: string | undefined, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      prefix,
      message,
      data,
    };

    const formatted = this.formatEntry(entry);

    // Always write diagnostic logs to stderr to preserve stdout for data output
    process.stderr.write(formatted + '\n');
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: Record<string, unknown>): void;
  debug(prefix: string, message: string, data?: Record<string, unknown>): void;
  debug(prefixOrMessage: string, messageOrData?: string | Record<string, unknown>, data?: Record<string, unknown>): void {
    if (typeof messageOrData === 'string') {
      this.log('debug', prefixOrMessage, messageOrData, data);
    } else {
      this.log('debug', undefined, prefixOrMessage, messageOrData);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, data?: Record<string, unknown>): void;
  info(prefix: string, message: string, data?: Record<string, unknown>): void;
  info(prefixOrMessage: string, messageOrData?: string | Record<string, unknown>, data?: Record<string, unknown>): void {
    if (typeof messageOrData === 'string') {
      this.log('info', prefixOrMessage, messageOrData, data);
    } else {
      this.log('info', undefined, prefixOrMessage, messageOrData);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>): void;
  warn(prefix: string, message: string, data?: Record<string, unknown>): void;
  warn(prefixOrMessage: string, messageOrData?: string | Record<string, unknown>, data?: Record<string, unknown>): void {
    if (typeof messageOrData === 'string') {
      this.log('warn', prefixOrMessage, messageOrData, data);
    } else {
      this.log('warn', undefined, prefixOrMessage, messageOrData);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, data?: Record<string, unknown>): void;
  error(prefix: string, message: string, data?: Record<string, unknown>): void;
  error(prefixOrMessage: string, messageOrData?: string | Record<string, unknown>, data?: Record<string, unknown>): void {
    if (typeof messageOrData === 'string') {
      this.log('error', prefixOrMessage, messageOrData, data);
    } else {
      this.log('error', undefined, prefixOrMessage, messageOrData);
    }
  }
}

export const logger = new DeploymentLogger(process.env.LOG_LEVEL as LogLevel | undefined);
