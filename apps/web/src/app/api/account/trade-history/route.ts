/**
 * Trade history endpoint
 * GET /api/account/trade-history?exchange=pacifica|hyperliquid
 */
import { withAuth } from '@/lib/server/auth';
import * as AccountService from '@/lib/server/services/account';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      const { searchParams } = new URL(request.url);
      const exchange = searchParams.get('exchange') || undefined;
      const fills = await AccountService.getFills(user.userId, exchange);
      return fills;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
