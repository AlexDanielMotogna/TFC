/**
 * Structured Error Logging Service
 * Centralized error tracking and monitoring
 *
 * Future integrations:
 * - Sentry for error tracking
 * - Database storage for admin panel
 * - Discord webhooks for critical alerts
 */

import { ErrorCode, ErrorCodeMetadata } from '../../apps/web/src/lib/server/error-codes';
import { ApiError } from '../../apps/web/src/lib/server/errors';

export interface ErrorLogEntry {
  errorId: string;
  timestamp: Date;
  code?: ErrorCode;
  category?: string;
  severity?: string;
  message: string;
  statusCode: number;
  userId?: string;
  requestPath?: string;
  requestMethod?: string;
  userAgent?: string;
  details?: Record<string, any>;
  stack?: string;
}

/**
 * ErrorLogger
 *
 * In-memory error logging with structured output.
 * Stores last 1000 errors for admin panel retrieval.
 *
 * Future enhancements:
 * - Database persistence
 * - Sentry integration
 * - Discord webhook alerts for CRITICAL errors
 */
class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private readonly MAX_LOGS = 1000; // Keep last 1000 errors in memory

  /**
   * Log an error with full context
   *
   * @param error - ApiError or generic Error instance
   * @param context - Request context (userId, path, method, userAgent)
   */
  logError(
    error: ApiError | Error,
    context?: {
      userId?: string;
      requestPath?: string;
      requestMethod?: string;
      userAgent?: string;
    }
  ): void {
    const isApiError = error instanceof ApiError;
    const errorId = isApiError ? error.errorId : 'N/A';
    const code = isApiError ? error.code : undefined;
    const statusCode = isApiError ? error.statusCode : 500;
    const details = isApiError ? error.details : undefined;

    const metadata = code ? ErrorCodeMetadata[code] : undefined;

    const logEntry: ErrorLogEntry = {
      errorId,
      timestamp: new Date(),
      code,
      category: metadata?.category,
      severity: metadata?.severity,
      message: error.message,
      statusCode,
      userId: context?.userId,
      requestPath: context?.requestPath,
      requestMethod: context?.requestMethod,
      userAgent: context?.userAgent,
      details,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };

    // Console output for development
    console.error('[ERROR]', {
      errorId: logEntry.errorId,
      code: logEntry.code,
      category: logEntry.category,
      severity: logEntry.severity,
      message: logEntry.message,
      userId: logEntry.userId,
      path: logEntry.requestPath,
    });

    // Store in memory (circular buffer - keep last MAX_LOGS)
    this.logs.push(logEntry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift(); // Remove oldest entry
    }

    // TODO: Send to Sentry
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureException(error, {
    //     tags: {
    //       errorId: logEntry.errorId,
    //       code: logEntry.code,
    //       category: logEntry.category,
    //       severity: logEntry.severity,
    //     },
    //     extra: {
    //       userId: context?.userId,
    //       requestPath: context?.requestPath,
    //       details: logEntry.details,
    //     },
    //   });
    // }

    // TODO: Store in database for admin panel
    // await prisma.errorLog.create({ data: logEntry });

    // TODO: Send Discord alert for CRITICAL errors
    // if (metadata?.severity === 'CRITICAL' && process.env.DISCORD_WEBHOOK_CRITICAL) {
    //   await fetch(process.env.DISCORD_WEBHOOK_CRITICAL, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       embeds: [{
    //         title: `🔴 CRITICAL ERROR: ${logEntry.code}`,
    //         description: logEntry.message,
    //         color: 0xFF0000,
    //         fields: [
    //           { name: 'Error ID', value: logEntry.errorId, inline: true },
    //           { name: 'User ID', value: logEntry.userId || 'N/A', inline: true },
    //           { name: 'Path', value: logEntry.requestPath || 'N/A', inline: false },
    //         ],
    //         timestamp: logEntry.timestamp.toISOString(),
    //       }],
    //     }),
    //   });
    // }
  }

  /**
   * Get recent error logs (for admin panel)
   *
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of error log entries
   */
  getRecentLogs(limit: number = 100): ErrorLogEntry[] {
    return this.logs.slice(-limit).reverse(); // Most recent first
  }

  /**
   * Get error statistics by code
   *
   * @returns Object mapping error codes to occurrence counts
   */
  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.logs.forEach((log) => {
      const key = log.code || 'UNKNOWN';
      stats[key] = (stats[key] || 0) + 1;
    });
    return stats;
  }

  /**
   * Get error statistics by category
   *
   * @returns Object mapping categories to occurrence counts
   */
  getErrorStatsByCategory(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.logs.forEach((log) => {
      const key = log.category || 'UNKNOWN';
      stats[key] = (stats[key] || 0) + 1;
    });
    return stats;
  }

  /**
   * Get error statistics by severity
   *
   * @returns Object mapping severity levels to occurrence counts
   */
  getErrorStatsBySeverity(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.logs.forEach((log) => {
      const key = log.severity || 'UNKNOWN';
      stats[key] = (stats[key] || 0) + 1;
    });
    return stats;
  }

  /**
   * Clear all stored error logs
   * (Use for testing or memory cleanup)
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get total error count
   *
   * @returns Total number of errors logged
   */
  getTotalCount(): number {
    return this.logs.length;
  }
}

/**
 * Singleton instance of ErrorLogger
 * Export for use across the application
 */
export const errorLogger = new ErrorLogger();
