/**
 * Orderbook endpoint
 * GET /api/markets/[symbol]/orderbook - Get orderbook for a symbol
 */
import { ExchangeProvider } from '@/lib/server/exchanges/provider';
import { errorResponse } from '@/lib/server/errors';

const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const aggLevel = parseInt(searchParams.get('aggLevel') || '1', 10);

    if (USE_EXCHANGE_ADAPTER) {
      // Use Exchange Adapter (with caching if Redis configured)
      const adapter = ExchangeProvider.getAdapter('pacifica');
      const normalizedSymbol = params.symbol.includes('-USD') ? params.symbol : `${params.symbol}-USD`;
      const orderbook = await adapter.getOrderbook(normalizedSymbol, aggLevel);
      return Response.json({ success: true, data: orderbook });
    }

    // Fallback to direct Pacifica calls
    const Pacifica = await import('@/lib/server/pacifica');
    const orderbook = await Pacifica.getOrderbook(params.symbol, aggLevel);
    return Response.json({ success: true, data: orderbook });
  } catch (error) {
    return errorResponse(error);
  }
}
