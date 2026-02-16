/**
 * Internal API: Record a fill for a limit/stop order during a fight
 * POST /api/internal/record-fill
 *
 * Called by fight-engine's FillDetector when it detects that a
 * limit/stop order placed during a fight has been filled on Pacifica.
 *
 * Reuses the same trade recording logic as market orders:
 * - Creates Trade record (platform metrics)
 * - Creates FightTrade record (fight PnL/exposure)
 * - Updates maxExposureUsed
 * - Emits STAKE_INFO websocket event
 *
 * @see Fight.md - Fill Detector architecture
 */

import { NextResponse } from 'next/server';
import { UnauthorizedError, BadRequestError, errorResponse } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordAllTradesWithDetails, type ExecutionDetails } from '@/lib/server/trade-recording';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

export async function POST(request: Request) {
  try {
    // Validate internal key
    const key = request.headers.get('X-Internal-Key');
    if (key !== INTERNAL_API_KEY) {
      throw new UnauthorizedError('Unauthorized', ErrorCode.ERR_AUTH_UNAUTHORIZED);
    }

    const body = await request.json();
    const {
      accountAddress,
      symbol,
      side,
      amount,
      orderId,
      historyId,
      executionPrice,
      fee,
      pnl,
      fightId,
      leverage,
    } = body;

    if (!accountAddress || !symbol || !side || !amount || !orderId || !historyId || !executionPrice) {
      throw new BadRequestError(
        'accountAddress, symbol, side, amount, orderId, historyId, and executionPrice are required',
        ErrorCode.ERR_VALIDATION_MISSING_FIELD
      );
    }

    console.log('[record-fill] Recording fill:', {
      accountAddress,
      symbol,
      side,
      amount,
      orderId,
      historyId,
      executionPrice,
      fightId,
    });

    const execDetails: ExecutionDetails = {
      executionPrice,
      fee: fee || '0',
      pnl: pnl || null,
      historyId: BigInt(historyId),
    };

    await recordAllTradesWithDetails(
      accountAddress,
      symbol,
      side,
      amount,
      orderId,
      execDetails,
      fightId,
      leverage
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    // Handle duplicate key errors gracefully (fill already recorded)
    if (err.code === 'P2002') {
      console.log('[record-fill] Fill already recorded (duplicate), returning success');
      return NextResponse.json({ success: true, duplicate: true });
    }
    console.error('[record-fill] Error:', err);
    return errorResponse(err);
  }
}
