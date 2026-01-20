/**
 * Fight order history endpoint
 * GET /api/fights/[id]/order-history
 * Returns all order actions during the fight
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, ForbiddenError } from '@/lib/server/errors';

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

      // Get all order actions for this fight
      // Include MARKET_ORDER, LIMIT_ORDER, and their filled states
      const orderActions = await prisma.tfcOrderAction.findMany({
        where: {
          fightId,
          userId: user.userId,
          actionType: {
            in: ['MARKET_ORDER', 'LIMIT_ORDER', 'ORDER_FILLED', 'ORDER_PARTIAL'],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Format to match Pacifica order history structure
      const formattedHistory = orderActions.map((action: any) => {
        // Determine order status based on action type and success
        let orderStatus = 'open';
        if (action.actionType === 'ORDER_FILLED') {
          orderStatus = 'filled';
        } else if (action.actionType === 'ORDER_PARTIAL') {
          orderStatus = 'partially_filled';
        } else if (!action.success) {
          orderStatus = 'cancelled';
        } else if (action.actionType === 'MARKET_ORDER') {
          // Market orders are typically filled immediately
          orderStatus = 'filled';
        }

        return {
          order_id: action.pacificaOrderId?.toString() || null,
          symbol: action.symbol,
          side: action.side,
          order_type: action.orderType?.toLowerCase() || 'market',
          amount: action.amount?.toString() || '0',
          filled_amount: action.filledAmount?.toString() || '0',
          initial_price: action.price?.toString() || null,
          average_filled_price: action.filledPrice?.toString() || null,
          stop_price: action.takeProfit?.toString() || action.stopLoss?.toString() || null,
          order_status: orderStatus,
          created_at: action.createdAt.toISOString(),
          // Fight metadata
          isFightOrder: true,
          fightId: action.fightId,
          actionType: action.actionType,
        };
      });

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
