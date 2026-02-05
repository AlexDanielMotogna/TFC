/**
 * Admin authentication middleware for API routes
 * Requires admin role in JWT or X-Admin-Secret header
 */
import { extractBearerToken, verifyToken } from './auth';
import { ForbiddenError, UnauthorizedError } from './errors';
import { ErrorCode } from './error-codes';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export interface AdminUser {
  userId: string;
  walletAddress: string;
  role: 'ADMIN';
}

/**
 * Middleware wrapper for admin-only API routes
 * Supports both JWT auth (with role check) and X-Admin-Secret header for scripts
 *
 * Usage: return withAdminAuth(request, async (user) => { ... })
 */
export async function withAdminAuth<T>(
  request: Request,
  handler: (user: AdminUser) => Promise<Response | T>
): Promise<Response> {
  try {
    // Fallback: X-Admin-Secret header for CLI/scripts
    const adminSecret = request.headers.get('X-Admin-Secret');
    if (adminSecret && ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
      const result = await handler({
        userId: 'system',
        walletAddress: 'system',
        role: 'ADMIN',
      });
      if (result instanceof Response) return result;
      return Response.json({ success: true, data: result });
    }

    // Standard JWT auth
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedError('Missing authorization token', ErrorCode.ERR_AUTH_MISSING_TOKEN);
    }

    const payload = verifyToken(token);

    // Check admin role - treat missing role as USER (backwards compatibility)
    if (payload.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access required', ErrorCode.ERR_AUTH_ADMIN_REQUIRED);
    }

    const result = await handler({
      userId: payload.sub,
      walletAddress: payload.walletAddress,
      role: 'ADMIN',
    });

    // If handler returns a Response, return it directly
    if (result instanceof Response) {
      return result;
    }

    // Otherwise wrap in JSON response
    return Response.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return Response.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    throw error;
  }
}
