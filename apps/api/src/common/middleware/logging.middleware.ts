import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createLogger, getContext } from '@tfc/logger';

const logger = createLogger({ service: 'api' });

/**
 * Middleware to log all incoming requests
 */
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl } = req;
    const ctx = getContext();

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      const level = statusCode >= 400 ? 'warn' : 'info';

      logger[level]('http.request', `${method} ${originalUrl} ${statusCode}`, {
        method,
        path: originalUrl,
        statusCode,
        durationMs: duration,
        requestId: ctx?.requestId,
      });
    });

    next();
  }
}
