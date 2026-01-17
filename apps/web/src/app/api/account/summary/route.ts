/**
 * Account summary endpoint
 * GET /api/account/summary
 */
import { withAuth } from '@/lib/server/auth';
import * as AccountService from '@/lib/server/services/account';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAuth(request, async (user) => {
      const summary = await AccountService.getSummary(user.userId);
      return summary;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
