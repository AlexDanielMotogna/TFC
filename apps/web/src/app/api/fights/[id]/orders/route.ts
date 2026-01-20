/**
 * Fight open orders endpoint
 * GET /api/fights/[id]/orders
 * Returns open orders that were placed during the fight
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, ForbiddenError } from '@/lib/server/errors';
import { getOpenOrders } from '@/lib/server/pacifica';

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
        throw new ForbiddenError('You are not a participant in this fight');
      }

      // Get Pacifica connection for this user
      const pacificaConnection = await prisma.pacificaConnection.findUnique({
        where: { userId: user.userId },
        select: { accountAddress: true },
      });

      if (!pacificaConnection?.accountAddress) {
        return Response.json({ success: true, data: [] });
      }

      // Get LIMIT_ORDER actions for this fight from TfcOrderAction
      const orderActions = await prisma.tfcOrderAction.findMany({
        where: {
          fightId,
          userId: user.userId,
          actionType: 'LIMIT_ORDER',
          success: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // If no limit orders were placed during this fight, return empty
      if (orderActions.length === 0) {
        return Response.json({ success: true, data: [] });
      }

      // Get current open orders from Pacifica
      const pacificaOrders = await getOpenOrders(pacificaConnection.accountAddress);

      // Filter to only orders that were placed during this fight
      // Cross-reference by pacificaOrderId
      const fightOrderIds = new Set(
        orderActions
          .filter(oa => oa.pacificaOrderId)
          .map(oa => oa.pacificaOrderId!.toString())
      );

      const fightOrders = pacificaOrders.filter((po: any) =>
        fightOrderIds.has(po.order_id?.toString())
      );

      // Format orders to match the expected structure
      const formattedOrders = fightOrders.map((order: any) => ({
        order_id: order.order_id,
        client_order_id: order.client_order_id,
        symbol: order.symbol,
        side: order.side,
        price: order.price,
        initial_amount: order.initial_amount || order.amount,
        amount: order.amount,
        filled_amount: order.filled_amount || '0',
        cancelled_amount: order.cancelled_amount || '0',
        order_type: order.order_type,
        stop_price: order.stop_price || null,
        reduce_only: order.reduce_only || false,
        created_at: order.created_at,
        updated_at: order.updated_at || order.created_at,
        // Fight metadata
        isFightOrder: true,
        fightId,
      }));

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
