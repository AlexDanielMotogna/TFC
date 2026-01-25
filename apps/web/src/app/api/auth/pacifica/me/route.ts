/**
 * Get current user's Pacifica connection status
 * GET /api/auth/pacifica/me
 */
import { withAuth } from '@/lib/server/auth';
import * as AuthService from '@/lib/server/services/auth';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      const connection = await AuthService.getConnection(user.userId);

      if (!connection) {
        return {
          connected: false,
          pacificaAddress: null,
        };
      }

      return {
        connected: connection.isActive,
        pacificaAddress: connection.accountAddress,
        connectedAt: connection.connectedAt.toISOString(),
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
