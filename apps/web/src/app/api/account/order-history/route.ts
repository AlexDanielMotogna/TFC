/**
 * Order history endpoint
 * GET /api/account/order-history?exchange=pacifica|hyperliquid
 *
 * Returns completed/cancelled orders (distinct from trade fills).
 * For exchanges that support it (Hyperliquid), uses the dedicated
 * historicalOrders API. Falls back to trade history for others.
 */
import { withAuth } from '@/lib/server/auth';
import * as AccountService from '@/lib/server/services/account';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      const { searchParams } = new URL(request.url);
      const exchange = searchParams.get('exchange') || undefined;
      const orders = await AccountService.getOrderHistory(user.userId, exchange);
      return orders;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
