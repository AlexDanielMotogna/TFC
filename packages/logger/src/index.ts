/**
 * Structured Logger for Trading Fight Club
 * @see Master-doc.md Section 9
 *
 * Requirements:
 * - JSON output
 * - Correlation IDs (request_id, trace_id)
 * - NEVER log secrets, tokens, API keys
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { LogEvent } from '@tfc/shared';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ServiceName = 'api' | 'realtime' | 'job' | 'web';
export type Environment = 'development' | 'staging' | 'production';

/**
 * Context stored in AsyncLocalStorage for request correlation
 */
export interface RequestContext {
  requestId: string;
  traceId?: string;
  userId?: string;
  fightId?: string;
  pacificaAccountId?: string;
}

/**
 * Full log entry structure
 * @see Master-doc.md Section 9.2
 */
export interface LogEntry {
  // Required fields
  service: ServiceName;
  env: Environment;
  timestamp: string;
  level: LogLevel;
  event: LogEvent | string;
  message: string;

  // Correlation fields (from context)
  request_id?: string;
  trace_id?: string;
  user_id?: string;
  fight_id?: string;
  pacifica_account_id?: string;

  // Additional context
  context?: Record<string, unknown>;

  // Error details (for error level)
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// ─────────────────────────────────────────────────────────────
// AsyncLocalStorage for Request Context
// ─────────────────────────────────────────────────────────────

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

/**
 * Get current request context
 */
export function getContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Update current context (merges with existing)
 */
export function updateContext(updates: Partial<RequestContext>): void {
  const current = requestContext.getStore();
  if (current) {
    Object.assign(current, updates);
  }
}

// ─────────────────────────────────────────────────────────────
// Logger Class
// ─────────────────────────────────────────────────────────────

export interface LoggerConfig {
  service: ServiceName;
  env?: Environment;
  minLevel?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private service: ServiceName;
  private env: Environment;
  private minLevel: number;

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.env = config.env || (process.env.NODE_ENV as Environment) || 'development';
    this.minLevel = LOG_LEVELS[config.minLevel || 'debug'];
  }

  /**
   * Create a log entry with all required fields
   */
  private createEntry(
    level: LogLevel,
    event: LogEvent | string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const reqContext = requestContext.getStore();

    const entry: LogEntry = {
      service: this.service,
      env: this.env,
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
    };

    // Add correlation IDs from context
    if (reqContext) {
      if (reqContext.requestId) entry.request_id = reqContext.requestId;
      if (reqContext.traceId) entry.trace_id = reqContext.traceId;
      if (reqContext.userId) entry.user_id = reqContext.userId;
      if (reqContext.fightId) entry.fight_id = reqContext.fightId;
      if (reqContext.pacificaAccountId) entry.pacifica_account_id = reqContext.pacificaAccountId;
    }

    // Add context if provided
    if (context && Object.keys(context).length > 0) {
      entry.context = this.sanitizeContext(context);
    }

    // Add error details if provided
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.env !== 'production' ? error.stack : undefined,
      };
    }

    return entry;
  }

  /**
   * Sanitize context to remove sensitive data
   * @see Master-doc.md Section 9.2: never log secrets, tokens, API keys
   */
  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'secret',
      'token',
      'apikey',
      'api_key',
      'privatekey',
      'private_key',
      'authorization',
      'credential',
      'signature',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();

      // Check if key contains sensitive words
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Output the log entry
   */
  private output(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    switch (entry.level) {
      case 'error':
        console.error(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      default:
        console.log(json);
    }
  }

  /**
   * Check if should log at this level
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  // ─────────────────────────────────────────────────────────────
  // Public Logging Methods
  // ─────────────────────────────────────────────────────────────

  debug(event: LogEvent | string, message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.output(this.createEntry('debug', event, message, context));
    }
  }

  info(event: LogEvent | string, message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.output(this.createEntry('info', event, message, context));
    }
  }

  warn(event: LogEvent | string, message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.output(this.createEntry('warn', event, message, context));
    }
  }

  error(
    event: LogEvent | string,
    message: string,
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    if (this.shouldLog('error')) {
      let error: Error | undefined;
      let ctx: Record<string, unknown> | undefined;

      if (errorOrContext instanceof Error) {
        error = errorOrContext;
        ctx = context;
      } else {
        ctx = errorOrContext;
      }

      this.output(this.createEntry('error', event, message, ctx, error));
    }
  }

  /**
   * Create a child logger with additional default context
   */
  child(defaultContext: Partial<RequestContext>): Logger {
    // This returns the same logger but updates context
    // The context will be picked up on next log call
    const ctx = requestContext.getStore();
    if (ctx) {
      Object.assign(ctx, defaultContext);
    }
    return this;
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────

export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

// ─────────────────────────────────────────────────────────────
// Utility: Generate Request ID
// ─────────────────────────────────────────────────────────────

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}
