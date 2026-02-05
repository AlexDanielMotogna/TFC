/**
 * Authentication utilities for Next.js API routes
 * Replaces NestJS JWT strategy and guards
 */
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from './errors';
import { prisma } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-not-for-production';

export interface JwtPayload {
  sub: string; // userId
  walletAddress: string;
  role?: 'USER' | 'ADMIN'; // Optional for backwards compatibility
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(
  userId: string,
  walletAddress: string,
  role: 'USER' | 'ADMIN' = 'USER'
): string {
  return jwt.sign(
    {
      sub: userId,
      walletAddress,
      role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Middleware wrapper for authenticated API routes
 * Usage: return withAuth(request, async (user) => { ... })
 *
 * Validates JWT token AND checks user status (blocks BANNED/DELETED users)
 */
export async function withAuth<T>(
  request: Request,
  handler: (user: { userId: string; walletAddress: string }) => Promise<Response | T>
): Promise<Response> {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedError('Missing authorization token');
    }

    const payload = verifyToken(token);

    // Check user status in database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, bannedReason: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status === 'BANNED') {
      throw new ForbiddenError(
        user.bannedReason || 'Your account has been banned. Please contact support.'
      );
    }

    if (user.status === 'DELETED') {
      throw new ForbiddenError('This account has been deleted.');
    }

    const result = await handler({
      userId: payload.sub,
      walletAddress: payload.walletAddress,
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
