/**
 * Orderbook endpoint
 * GET /api/markets/[symbol]/orderbook - Get orderbook for a symbol
 */
import * as Pacifica from '@/lib/server/pacifica';
import { errorResponse } from '@/lib/server/errors';

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const aggLevel = parseInt(searchParams.get('aggLevel') || '1', 10);

    const orderbook = await Pacifica.getOrderbook(params.symbol, aggLevel);
    return Response.json({ success: true, data: orderbook });
  } catch (error) {
    return errorResponse(error);
  }
}
