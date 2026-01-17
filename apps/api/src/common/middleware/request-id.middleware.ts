import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { runWithContext, generateRequestId } from '@tfc/logger';

/**
 * Middleware to generate and propagate request IDs
 * @see Master-doc.md Section 9.2
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

    // Set response header
    res.setHeader('x-request-id', requestId);

    // Run the rest of the request with context
    runWithContext({ requestId }, () => {
      next();
    });
  }
}
