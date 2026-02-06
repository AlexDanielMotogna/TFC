/**
 * GET /api/users/[id]/trades
 * Fetch user's trade history from Pacifica API (includes external trades)
 */
import { ExchangeProvider } from '@/lib/server/exchanges/provider';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000');

    // Get user's wallet address from database
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { walletAddress: true },
    });

    if (!user) {
      return Response.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    let pacificaTrades;

    if (USE_EXCHANGE_ADAPTER) {
      // Use Exchange Adapter (with caching if Redis configured)
      const adapter = await ExchangeProvider.getUserAdapter(params.id);
      pacificaTrades = await adapter.getTradeHistory({
        accountId: user.walletAddress,
        limit: Math.min(limit, 1000),
      });

      // Adapter returns normalized format - transform to UI expectations
      const trades = pacificaTrades.map((trade) => ({
        id: trade.historyId.toString(),
        symbol: trade.symbol,
        side: trade.side, // Already normalized to BUY/SELL
        position: trade.metadata.position || trade.side, // Original position from metadata
        amount: trade.amount,
        price: trade.price,
        fee: trade.fee,
        pnl: trade.pnl,
        leverage: null,
        executedAt: new Date(trade.executedAt).toISOString(),
      }));

      return Response.json({
        success: true,
        data: {
          trades,
          total: trades.length,
        },
      });
    }

    // Fallback to direct Pacifica calls
    const Pacifica = await import('@/lib/server/pacifica');
    pacificaTrades = await Pacifica.getTradeHistory({
      accountAddress: user.walletAddress,
      limit: Math.min(limit, 1000),
    });

    // Transform Pacifica response to match UI expectations
    const trades = pacificaTrades.map((trade: any) => ({
      id: trade.history_id.toString(),
      symbol: trade.symbol,
      side: convertPacificaSide(trade.side),
      position: trade.side,
      amount: trade.amount,
      price: trade.price,
      fee: trade.fee,
      pnl: trade.pnl,
      leverage: null,
      executedAt: new Date(trade.created_at).toISOString(),
    }));

    return Response.json({
      success: true,
      data: {
        trades,
        total: trades.length,
      },
    });
  } catch (error) {
    return errorResponse(error, {
      requestPath: request.url,
      requestMethod: request.method,
    });
  }
}

// Helper to convert Pacifica side to BUY/SELL
function convertPacificaSide(pacificaSide: string): string {
  if (pacificaSide === 'open_long' || pacificaSide === 'close_short') {
    return 'BUY';
  } else if (pacificaSide === 'open_short' || pacificaSide === 'close_long') {
    return 'SELL';
  }
  return pacificaSide; // Fallback
}
