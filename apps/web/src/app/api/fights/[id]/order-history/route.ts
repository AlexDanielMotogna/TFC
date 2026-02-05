/**
 * Fight order history endpoint
 * GET /api/fights/[id]/order-history
 * Returns order history from Pacifica filtered to fight orders only
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, ForbiddenError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fightId } = await params;

  return withAuth(request, async (user) => {
    try {
      // Verify user is a participant in this fight and get fight details
      const participant = await prisma.fightParticipant.findFirst({
        where: {
          fightId,
          userId: user.userId,
        },
      });

      if (!participant) {
        throw new ForbiddenError('You are not a participant in this fight', ErrorCode.ERR_FIGHT_NOT_PARTICIPANT);
      }

      // Get fight details for time range
      const fight = await prisma.fight.findUnique({
        where: { id: fightId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
        },
      });

      // Get Pacifica connection for this user
      const pacificaConnection = await prisma.pacificaConnection.findUnique({
        where: { userId: user.userId },
        select: { accountAddress: true },
      });

      if (!pacificaConnection?.accountAddress) {
        return Response.json({ success: true, data: [] });
      }

      // Get order actions recorded during this fight (for cross-referencing)
      const orderActions = await prisma.tfcOrderAction.findMany({
        where: {
          fightId,
          userId: user.userId,
          actionType: {
            in: ['MARKET_ORDER', 'LIMIT_ORDER', 'SET_TPSL'],
          },
          success: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // If no orders were placed during this fight, return empty
      if (orderActions.length === 0) {
        return Response.json({ success: true, data: [] });
      }

      // Build sets for matching
      // Order IDs for MARKET_ORDER and LIMIT_ORDER
      const fightOrderIds = new Set(
        orderActions
          .filter(oa => oa.pacificaOrderId && (oa.actionType === 'MARKET_ORDER' || oa.actionType === 'LIMIT_ORDER'))
          .map(oa => oa.pacificaOrderId!.toString())
      );

      // Symbols for SET_TPSL (TP/SL don't have pacificaOrderId at creation)
      const tpslSymbols = new Set(
        orderActions.filter(oa => oa.actionType === 'SET_TPSL').map(oa => oa.symbol)
      );

      // Calculate fight time range (Pacifica uses milliseconds for timestamps)
      const fightStartMs = fight?.startedAt
        ? new Date(fight.startedAt).getTime()
        : undefined;
      const fightEndMs = fight?.endedAt
        ? new Date(fight.endedAt).getTime()
        : undefined;

      // Fetch order history from Pacifica (without time filter - we'll filter locally)
      // This ensures we get all recent orders and filter precisely
      const url = `${PACIFICA_API_URL}/api/v1/orders/history?account=${pacificaConnection.accountAddress}&limit=200`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error('[FightOrderHistory] Pacifica API error:', response.status);
        return Response.json({ success: true, data: [] });
      }

      const pacificaResponse = await response.json();
      const pacificaOrders = pacificaResponse.data || [];

      console.log('[FightOrderHistory] Pacifica returned', pacificaOrders.length, 'orders');
      console.log('[FightOrderHistory] Fight order IDs:', Array.from(fightOrderIds));
      console.log('[FightOrderHistory] TP/SL symbols:', Array.from(tpslSymbols));
      console.log('[FightOrderHistory] Fight time range:', { fightStartMs, fightEndMs });
      if (pacificaOrders.length > 0) {
        console.log('[FightOrderHistory] Sample order:', JSON.stringify(pacificaOrders[0], null, 2));
      }

      // Filter to only fight orders
      const fightOrders = pacificaOrders.filter((po: any) => {
        // Match by order ID (for MARKET_ORDER and LIMIT_ORDER)
        if (fightOrderIds.has(po.order_id?.toString())) {
          console.log('[FightOrderHistory] Matched by order ID:', po.order_id, 'created_at:', po.created_at);
          return true;
        }

        // Match TP/SL orders by symbol, order type, AND time range
        // TP/SL orders don't have their order_id recorded at creation time,
        // so we match by symbol + type + created during fight
        const orderType = po.order_type || '';
        const isTpSlOrder = orderType.includes('take_profit') || orderType.includes('stop_loss');
        if (isTpSlOrder && tpslSymbols.has(po.symbol)) {
          // Verify order was created during the fight
          const orderTime = po.created_at; // Pacifica timestamp (milliseconds)
          if (orderTime && fightStartMs) {
            const isAfterStart = orderTime >= fightStartMs;
            const isBeforeEnd = !fightEndMs || orderTime <= fightEndMs;
            console.log('[FightOrderHistory] TP/SL check:', {
              order_id: po.order_id,
              symbol: po.symbol,
              orderTime,
              fightStartMs,
              fightEndMs,
              isAfterStart,
              isBeforeEnd,
            });
            if (isAfterStart && isBeforeEnd) {
              return true;
            }
          }
        }
        return false;
      });

      console.log('[FightOrderHistory] Filtered to', fightOrders.length, 'fight orders');
      if (fightOrders.length > 0) {
        console.log('[FightOrderHistory] First matched order:', JSON.stringify(fightOrders[0], null, 2));
      }

      // Pass through Pacifica data with same structure as "All" view
      // Frontend handles formatting (order_type like "stop_loss_market" -> "Stop Loss Market")
      const formattedHistory = fightOrders.map((order: any) => ({
        // Pass through all Pacifica fields as-is (same as "All" view)
        order_id: order.order_id,
        symbol: order.symbol,
        side: order.side,
        order_type: order.order_type || 'limit',
        amount: order.initial_amount || '0', // Frontend uses 'amount' field
        initial_amount: order.initial_amount || '0',
        filled_amount: order.filled_amount || '0',
        cancelled_amount: order.cancelled_amount || '0',
        initial_price: order.initial_price || '0',
        average_filled_price: order.average_filled_price || null,
        stop_price: order.stop_price || null,
        order_status: order.order_status || 'open',
        reduce_only: order.reduce_only || false,
        created_at: order.created_at,
        updated_at: order.updated_at || order.created_at,
        // Fight metadata
        isFightOrder: true,
        fightId,
      }));

      return Response.json({
        success: true,
        data: formattedHistory,
      });
    } catch (error) {
      console.error('[FightOrderHistory] Error:', error);
      return errorResponse(error);
    }
  });
}
