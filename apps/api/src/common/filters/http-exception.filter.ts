import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { createLogger, getContext } from '@tfc/logger';

const logger = createLogger({ service: 'api' });

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const reqContext = getContext();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        code = (exceptionResponse as any).code || 'HTTP_ERROR';
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;

      // Report to Sentry for unexpected errors
      Sentry.captureException(exception, {
        tags: {
          requestId: reqContext?.requestId,
          userId: reqContext?.userId,
        },
      });
    }

    // Log the error
    logger.error('http.error', message, exception instanceof Error ? exception : undefined, {
      statusCode: status,
      path: request.url,
      method: request.method,
      code,
    });

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        statusCode: status,
      },
      requestId: reqContext?.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
