/**
 * Fight open orders endpoint
 * GET /api/fights/[id]/orders
 * Returns open orders that were placed during the fight
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, ForbiddenError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { getOpenOrders, getPositions } from '@/lib/server/pacifica';

// Format order type to match "All" view display
function formatOrderType(orderType: string): string {
  if (orderType === 'take_profit_market') return 'TP MARKET';
  if (orderType === 'stop_loss_market') return 'SL MARKET';
  if (orderType === 'take_profit_limit') return 'TP LIMIT';
  if (orderType === 'stop_loss_limit') return 'SL LIMIT';
  if (orderType === 'limit') return 'LIMIT';
  if (orderType === 'market') return 'MARKET';
  return orderType?.toUpperCase() || 'UNKNOWN';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fightId } = await params;

  return withAuth(request, async (user) => {
    try {
      // Verify user is a participant in this fight
      const participant = await prisma.fightParticipant.findFirst({
        where: {
          fightId,
          userId: user.userId,
        },
        include: {
          fight: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!participant) {
        throw new ForbiddenError('You are not a participant in this fight', ErrorCode.ERR_FIGHT_NOT_PARTICIPANT);
      }

      // Get Pacifica connection for this user
      const pacificaConnection = await prisma.pacificaConnection.findUnique({
        where: { userId: user.userId },
        select: { accountAddress: true },
      });

      if (!pacificaConnection?.accountAddress) {
        return Response.json({ success: true, data: [] });
      }

      // Get LIMIT_ORDER and SET_TPSL (stop loss/take profit) actions for this fight
      // Stop loss orders are recorded as SET_TPSL, not LIMIT_ORDER
      const orderActions = await prisma.tfcOrderAction.findMany({
        where: {
          fightId,
          userId: user.userId,
          actionType: {
            in: ['LIMIT_ORDER', 'SET_TPSL'],
          },
          success: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // If no orders were placed during this fight, return empty
      if (orderActions.length === 0) {
        return Response.json({ success: true, data: [] });
      }

      // Get current open orders and positions from Pacifica
      const [pacificaOrders, pacificaPositions] = await Promise.all([
        getOpenOrders(pacificaConnection.accountAddress),
        getPositions(pacificaConnection.accountAddress),
      ]);

      // Build position map for TP/SL order size lookup
      const positionMap = new Map<string, string>();
      pacificaPositions.forEach((pos: any) => {
        // Key: symbol-side (TP/SL have opposite side to position)
        positionMap.set(`${pos.symbol}-${pos.side}`, pos.amount || '0');
      });

      // Separate LIMIT_ORDER and SET_TPSL actions
      const limitOrderActions = orderActions.filter(oa => oa.actionType === 'LIMIT_ORDER');
      const tpslActions = orderActions.filter(oa => oa.actionType === 'SET_TPSL');

      // For LIMIT_ORDER: cross-reference by pacificaOrderId
      const fightOrderIds = new Set(
        limitOrderActions
          .filter(oa => oa.pacificaOrderId)
          .map(oa => oa.pacificaOrderId!.toString())
      );

      // For SET_TPSL: match by symbol (TP/SL don't have pacificaOrderId)
      // TP/SL orders in Pacifica have types: sl_market, tp_market, sl_limit, tp_limit
      const tpslSymbols = new Set(
        tpslActions.map(oa => oa.symbol)
      );

      const fightOrders = pacificaOrders.filter((po: any) => {
        // Match limit orders by order ID
        if (fightOrderIds.has(po.order_id?.toString())) {
          return true;
        }
        // Match TP/SL orders by symbol and order type
        // Pacifica returns order_type like: "take_profit_market", "stop_loss_market"
        const orderType = po.order_type || '';
        const isTpSlOrder = orderType.includes('take_profit') || orderType.includes('stop_loss');
        if (isTpSlOrder && tpslSymbols.has(po.symbol)) {
          return true;
        }
        return false;
      });

      // Format orders to match the expected structure (same as "All" view)
      const formattedOrders = fightOrders.map((order: any) => {
        const orderType = order.order_type || '';
        const isTpSlOrder = orderType.includes('take_profit') || orderType.includes('stop_loss');

        // For TP/SL orders, get size from the matching position
        // TP/SL orders have opposite side to the position they protect
        // order.side 'ask' = closing LONG (position side 'bid')
        // order.side 'bid' = closing SHORT (position side 'ask')
        let resolvedAmount = order.initial_amount || order.amount || '0';
        if (isTpSlOrder && (!resolvedAmount || resolvedAmount === '0' || parseFloat(resolvedAmount) === 0)) {
          const positionSide = order.side === 'ask' ? 'bid' : 'ask';
          const positionAmount = positionMap.get(`${order.symbol}-${positionSide}`);
          if (positionAmount) {
            resolvedAmount = positionAmount;
          }
        }

        // For TP/SL orders, use stop_price as price (matches "All" view behavior)
        const resolvedPrice = isTpSlOrder ? (order.stop_price || order.price) : order.price;

        return {
          order_id: order.order_id,
          client_order_id: order.client_order_id,
          symbol: order.symbol,
          side: order.side,
          price: resolvedPrice,
          initial_amount: resolvedAmount,
          amount: resolvedAmount,
          filled_amount: order.filled_amount || '0',
          cancelled_amount: order.cancelled_amount || '0',
          order_type: formatOrderType(orderType),
          stop_price: order.stop_price || null,
          reduce_only: order.reduce_only || false,
          created_at: order.created_at,
          updated_at: order.updated_at || order.created_at,
          // Fight metadata
          isFightOrder: true,
          fightId,
        };
      });

      return Response.json({
        success: true,
        data: formattedOrders,
      });
    } catch (error) {
      console.error('[FightOrders] Error:', error);
      return errorResponse(error);
    }
  });
}
