/**
 * Recent trades endpoint
 * GET /api/markets/[symbol]/trades - Get recent trades for a symbol
 */
import { ExchangeProvider } from '@/lib/server/exchanges/provider';
import { errorResponse } from '@/lib/server/errors';

const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    if (USE_EXCHANGE_ADAPTER) {
      // Use Exchange Adapter (with caching if Redis configured)
      const adapter = ExchangeProvider.getAdapter('pacifica');
      const normalizedSymbol = params.symbol.includes('-USD') ? params.symbol : `${params.symbol}-USD`;
      const trades = await adapter.getRecentTrades(normalizedSymbol);
      return Response.json({ success: true, data: trades });
    }

    // Fallback to direct Pacifica calls
    const Pacifica = await import('@/lib/server/pacifica');
    const trades = await Pacifica.getRecentTrades(params.symbol);
    return Response.json({ success: true, data: trades });
  } catch (error) {
    return errorResponse(error);
  }
}
