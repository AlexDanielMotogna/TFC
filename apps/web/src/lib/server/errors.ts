/**
 * Error handling utilities for API routes
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limited') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class StakeLimitError extends ApiError {
  public details: {
    stake: number;
    currentExposure: number;
    orderNotional: number;
    totalExposure: number;
    available: number;
  };

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
    super(message, 400);
    this.name = 'StakeLimitError';
    this.details = details;
  }
}

export function errorResponse(error: unknown): Response {
  console.error('API Error:', error);

  if (error instanceof StakeLimitError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        code: 'STAKE_LIMIT_EXCEEDED',
        details: error.details,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ApiError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        statusCode: error.statusCode,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return Response.json(
    {
      success: false,
      error: 'Internal server error',
    },
    { status: 500 }
  );
}
