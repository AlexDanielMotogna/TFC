/**
 * Order Action Recording
 * Logs all TFC order-related actions to the database
 */

import { prisma } from '@tfc/db';

type OrderActionType =
  | 'MARKET_ORDER'
  | 'LIMIT_ORDER'
  | 'CANCEL_ORDER'
  | 'CANCEL_ALL'
  | 'SET_TPSL'
  | 'CANCEL_STOP'
  | 'CREATE_STOP'
  | 'ORDER_FILLED'
  | 'ORDER_PARTIAL'
  | 'EDIT_ORDER';

interface RecordOrderActionParams {
  walletAddress: string;
  actionType: OrderActionType;
  symbol: string;
  side?: string;
  orderType?: string;
  amount?: string;
  size?: string;
  price?: string;
  takeProfit?: string;
  stopLoss?: string;
  reduceOnly?: boolean;
  pacificaOrderId?: number | bigint;
  pacificaHistoryId?: number | bigint;
  filledAmount?: string;
  filledPrice?: string;
  fee?: string;
  pnl?: string;
  leverage?: number;
  fightId?: string;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Record an order action to the TfcOrderAction table
 */
export async function recordOrderAction(params: RecordOrderActionParams): Promise<void> {
  try {
    // Find user by wallet address
    const user = await prisma.user.findUnique({
      where: { walletAddress: params.walletAddress },
    });

    const userId = user?.id || 'unknown';

    // Use size as alias for amount if amount not provided
    const amountValue = params.amount || params.size;

    await prisma.tfcOrderAction.create({
      data: {
        userId,
        walletAddress: params.walletAddress,
        actionType: params.actionType as any,
        symbol: params.symbol,
        side: params.side || null,
        orderType: params.orderType || null,
        amount: amountValue ? parseFloat(amountValue) : null,
        price: params.price ? parseFloat(params.price) : null,
        takeProfit: params.takeProfit ? parseFloat(params.takeProfit) : null,
        stopLoss: params.stopLoss ? parseFloat(params.stopLoss) : null,
        pacificaOrderId: params.pacificaOrderId ? BigInt(params.pacificaOrderId) : null,
        pacificaHistoryId: params.pacificaHistoryId ? BigInt(params.pacificaHistoryId) : null,
        filledAmount: params.filledAmount ? parseFloat(params.filledAmount) : null,
        filledPrice: params.filledPrice ? parseFloat(params.filledPrice) : null,
        fee: params.fee ? parseFloat(params.fee) : null,
        pnl: params.pnl ? parseFloat(params.pnl) : null,
        leverage: params.leverage || null,
        fightId: params.fightId || null,
        success: params.success !== false, // Default to true
        errorMessage: params.errorMessage || null,
      },
    });

    console.log('[recordOrderAction] Action recorded:', {
      walletAddress: params.walletAddress,
      actionType: params.actionType,
      symbol: params.symbol,
      success: params.success !== false,
    });
  } catch (error) {
    // Don't throw - just log the error
    console.error('[recordOrderAction] Failed to record action:', error);
  }
}
