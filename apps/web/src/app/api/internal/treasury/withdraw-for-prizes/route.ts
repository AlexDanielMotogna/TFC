/**
 * Internal API: Withdraw prize pool from Pacifica
 * POST /api/internal/treasury/withdraw-for-prizes
 *
 * Called by the jobs service when a week is finalized to withdraw
 * the entire prize pool in one transaction (saves on Pacifica fees).
 *
 * Body: { amount: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Treasury from '@/lib/server/treasury';

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(request: NextRequest) {
  // Verify internal API secret
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!INTERNAL_API_SECRET || token !== INTERNAL_API_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Get current balances
    const balances = await Treasury.getBalances();

    console.log('[Treasury] Withdraw for prizes requested:', {
      requestedAmount: amount,
      currentBalances: balances,
    });

    // Check if we already have enough on-chain
    if (balances.onChainUsdc >= amount) {
      return NextResponse.json({
        success: true,
        message: 'Treasury already has sufficient funds',
        data: {
          requestedAmount: amount,
          availableOnChain: balances.onChainUsdc,
          withdrawNeeded: false,
        },
      });
    }

    // Check if Pacifica has enough
    const neededFromPacifica = amount - balances.onChainUsdc + 1; // +1 buffer

    if (balances.pacificaBalance < neededFromPacifica) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient funds in Pacifica',
        data: {
          requestedAmount: amount,
          availableOnChain: balances.onChainUsdc,
          availableInPacifica: balances.pacificaBalance,
          needed: neededFromPacifica,
        },
      }, { status: 400 });
    }

    // Withdraw from Pacifica
    const withdrawResult = await Treasury.withdrawFromPacifica(neededFromPacifica);

    if (!withdrawResult.success) {
      return NextResponse.json({
        success: false,
        error: `Pacifica withdrawal failed: ${withdrawResult.error}`,
      }, { status: 500 });
    }

    console.log('[Treasury] Prize pool withdrawal successful:', {
      withdrawnAmount: neededFromPacifica,
      forPrizePool: amount,
    });

    return NextResponse.json({
      success: true,
      message: 'Prize pool funds withdrawn successfully',
      data: {
        requestedAmount: amount,
        withdrawnAmount: neededFromPacifica,
        previousOnChain: balances.onChainUsdc,
      },
    });
  } catch (error) {
    console.error('[Treasury] Withdraw for prizes error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
