/**
 * GET /api/users/[id]/trades
 * Fetch user's individual trades (excluding fight trades)
 */
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch trades where fightId is null (individual trades only)
    const trades = await prisma.trade.findMany({
      where: {
        userId: params.id,
        fightId: null, // Only non-fight trades
      },
      orderBy: { executedAt: 'desc' },
      take: Math.min(limit, 1000), // Cap at 1000 for performance
      skip: offset,
      select: {
        id: true,
        symbol: true,
        side: true,
        amount: true,
        price: true,
        fee: true,
        pnl: true,
        leverage: true,
        executedAt: true,
      },
    });

    const total = await prisma.trade.count({
      where: {
        userId: params.id,
        fightId: null,
      },
    });

    return Response.json({
      success: true,
      data: {
        trades,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    return errorResponse(error, {
      requestPath: request.url,
      requestMethod: request.method,
    });
  }
}
