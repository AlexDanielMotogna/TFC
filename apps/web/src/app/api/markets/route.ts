/**
 * Markets endpoint
 * GET /api/markets - Get all markets info
 */
import * as Pacifica from '@/lib/server/pacifica';
import { errorResponse } from '@/lib/server/errors';

export async function GET() {
  try {
    const markets = await Pacifica.getMarkets();
    return Response.json({ success: true, data: markets });
  } catch (error) {
    return errorResponse(error);
  }
}
