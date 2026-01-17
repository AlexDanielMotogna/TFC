/**
 * Recent trades endpoint
 * GET /api/markets/[symbol]/trades - Get recent trades for a symbol
 */
import * as Pacifica from '@/lib/server/pacifica';
import { errorResponse } from '@/lib/server/errors';

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const trades = await Pacifica.getRecentTrades(params.symbol);
    return Response.json({ success: true, data: trades });
  } catch (error) {
    return errorResponse(error);
  }
}
