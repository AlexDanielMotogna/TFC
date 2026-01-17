/**
 * Positions endpoint
 * GET /api/account/positions
 */
import { withAuth } from '@/lib/server/auth';
import * as AccountService from '@/lib/server/services/account';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAuth(request, async (user) => {
      const positions = await AccountService.getPositions(user.userId);
      return positions;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
