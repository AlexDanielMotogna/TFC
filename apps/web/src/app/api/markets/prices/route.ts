/**
 * Market prices endpoint
 * GET /api/markets/prices - Get all market prices
 */
import * as Pacifica from '@/lib/server/pacifica';
import { errorResponse } from '@/lib/server/errors';

export async function GET() {
  try {
    const prices = await Pacifica.getPrices();
    return Response.json({ success: true, data: prices });
  } catch (error) {
    return errorResponse(error);
  }
}
