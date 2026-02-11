/**
 * Klines/Candles endpoint
 * GET /api/markets/[symbol]/klines - Get historical candles
 */
import { ExchangeProvider } from '@/lib/server/exchanges/provider';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const interval = searchParams.get('interval');
    const startTimeStr = searchParams.get('startTime');
    const endTimeStr = searchParams.get('endTime');

    if (!interval || !startTimeStr) {
      throw new BadRequestError('interval and startTime are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    if (USE_EXCHANGE_ADAPTER) {
      // Use Exchange Adapter (with caching if Redis configured)
      const adapter = ExchangeProvider.getAdapter('pacifica');
      const normalizedSymbol = params.symbol.includes('-USD') ? params.symbol : `${params.symbol}-USD`;
      const klines = await adapter.getKlines({
        symbol: normalizedSymbol,
        interval,
        startTime: parseInt(startTimeStr, 10),
        endTime: endTimeStr ? parseInt(endTimeStr, 10) : undefined,
      });

      return Response.json({ success: true, data: klines });
    }

    // Fallback to direct Pacifica calls
    const Pacifica = await import('@/lib/server/pacifica');
    const klines = await Pacifica.getKlines({
      symbol: params.symbol,
      interval,
      startTime: parseInt(startTimeStr, 10),
      endTime: endTimeStr ? parseInt(endTimeStr, 10) : undefined,
    });

    return Response.json({ success: true, data: klines });
  } catch (error) {
    return errorResponse(error);
  }
}
