/**
 * Open orders endpoint
 * GET /api/account/orders/open
 */
import { withAuth } from '@/lib/server/auth';
import * as AccountService from '@/lib/server/services/account';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      const orders = await AccountService.getOpenOrders(user.userId);
      return orders;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
