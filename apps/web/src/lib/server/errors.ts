/**
 * Error handling utilities for API routes
 * Enhanced with error codes, tracking IDs, and structured logging
 */

import { ErrorCode } from './error-codes.js';
import { errorLogger } from './logger.js';
import { randomUUID } from 'crypto';

export class ApiError extends Error {
  public readonly errorId: string;
  public readonly code?: ErrorCode;
  public readonly timestamp: Date;
  public readonly details?: Record<string, any>;

  constructor(message: string, public statusCode: number = 500, code?: ErrorCode, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiError';
    this.errorId = randomUUID(); // Unique tracking ID
    this.code = code;
    this.timestamp = new Date();
    this.details = details;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 401, code, details);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 404, code, details);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 400, code, details);
    this.name = 'BadRequestError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 403, code, details);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 409, code, details);
    this.name = 'ConflictError';
  }
}

export class BusinessLogicError extends ApiError {
  constructor(message: string, code: ErrorCode, details?: Record<string, any>) {
    super(message, 422, code, details); // 422 for business logic (Pacifica standard)
    this.name = 'BusinessLogicError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limited', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 429, code, details);
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 500, code, details);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service unavailable', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 503, code, details);
    this.name = 'ServiceUnavailableError';
  }
}

export class GatewayTimeoutError extends ApiError {
  constructor(message = 'Gateway timeout', code?: ErrorCode, details?: Record<string, any>) {
    super(message, 504, code, details);
    this.name = 'GatewayTimeoutError';
  }
}

export class StakeLimitError extends BusinessLogicError {
  constructor(
    message: string,
    details: {
      stake: number;
      currentExposure: number;
      orderNotional: number;
      totalExposure: number;
      available: number;
    }
  ) {
    super(message, ErrorCode.ERR_ORDER_STAKE_LIMIT_EXCEEDED, details);
    this.name = 'StakeLimitError';
  }
}

/**
 * Enhanced centralized error response handler
 * Logs all errors with structured format and returns consistent JSON responses
 *
 * @param error - Error object (ApiError or generic Error)
 * @param context - Optional request context for logging (userId, path, method, userAgent)
 * @returns Response with error details
 */
export function errorResponse(
  error: unknown,
  context?: {
    userId?: string;
    requestPath?: string;
    requestMethod?: string;
    userAgent?: string;
  }
): Response {
  // Log error with context
  if (error instanceof ApiError || error instanceof Error) {
    errorLogger.logError(error, context);
  }

  // Handle StakeLimitError (special case with detailed metrics)
  if (error instanceof StakeLimitError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        errorId: error.errorId,
        details: error.details,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    );
  }

  // Handle all ApiError subclasses
  if (error instanceof ApiError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        errorId: error.errorId,
        details: error.details,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    );
  }

  // Handle generic Error
  if (error instanceof Error) {
    console.error('Unhandled error:', error);
    return Response.json(
      {
        success: false,
        error: error.message,
        statusCode: 500,
      },
      { status: 500 }
    );
  }

  // Unknown error type
  console.error('Unknown error type:', error);
  return Response.json(
    {
      success: false,
      error: 'An unexpected error occurred',
      statusCode: 500,
    },
    { status: 500 }
  );
}
