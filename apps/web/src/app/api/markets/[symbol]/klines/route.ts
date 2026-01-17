/**
 * Klines/Candles endpoint
 * GET /api/markets/[symbol]/klines - Get historical candles
 */
import * as Pacifica from '@/lib/server/pacifica';
import { errorResponse, BadRequestError } from '@/lib/server/errors';

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
      throw new BadRequestError('interval and startTime are required');
    }

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
