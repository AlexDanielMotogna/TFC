/**
 * Markets endpoint
 * GET /api/markets - Get all markets info
 */
import { ExchangeProvider } from '@/lib/server/exchanges/provider';
import { errorResponse } from '@/lib/server/errors';

const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

export async function GET() {
  try {
    if (USE_EXCHANGE_ADAPTER) {
      // Use Exchange Adapter (with caching if Redis configured)
      // Markets are public data, no userId needed
      const adapter = ExchangeProvider.getAdapter('pacifica');
      const markets = await adapter.getMarkets();
      return Response.json({ success: true, data: markets });
    }

    // Fallback to direct Pacifica calls
    const Pacifica = await import('@/lib/server/pacifica');
    const markets = await Pacifica.getMarkets();
    return Response.json({ success: true, data: markets });
  } catch (error) {
    return errorResponse(error);
  }
}
