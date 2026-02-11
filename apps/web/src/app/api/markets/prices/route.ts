/**
 * Market prices endpoint
 * GET /api/markets/prices - Get all market prices
 */
import { ExchangeProvider } from '@/lib/server/exchanges/provider';
import { errorResponse } from '@/lib/server/errors';

const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

export async function GET() {
  try {
    if (USE_EXCHANGE_ADAPTER) {
      // Use Exchange Adapter (with caching if Redis configured)
      // Prices are public data, no userId needed
      const adapter = ExchangeProvider.getAdapter('pacifica');
      const prices = await adapter.getPrices();
      return Response.json({ success: true, data: prices });
    }

    // Fallback to direct Pacifica calls
    const Pacifica = await import('@/lib/server/pacifica');
    const prices = await Pacifica.getPrices();
    return Response.json({ success: true, data: prices });
  } catch (error) {
    return errorResponse(error);
  }
}
