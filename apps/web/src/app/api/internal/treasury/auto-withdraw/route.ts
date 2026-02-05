/**
 * Internal Treasury Auto-Withdraw API
 * Called by the jobs service to automatically withdraw funds from Pacifica
 * when the on-chain treasury balance is low.
 *
 * POST /api/internal/treasury/auto-withdraw
 * Headers: { Authorization: Bearer <INTERNAL_API_SECRET> }
 *
 * This ensures the treasury wallet always has funds available for prize claims.
 */
import { NextRequest, NextResponse } from 'next/server';
import { UnauthorizedError, errorResponse } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import * as Treasury from '@/lib/server/treasury';

// Internal API secret for job authentication
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

// Minimum balance threshold (in USDC) - withdraw when below this
const MIN_TREASURY_BALANCE = 100;

// Target balance after withdrawal (in USDC)
const TARGET_TREASURY_BALANCE = 500;

export async function POST(request: NextRequest) {
  try {
    // Verify internal API secret
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!INTERNAL_API_SECRET || token !== INTERNAL_API_SECRET) {
      throw new UnauthorizedError('Unauthorized', ErrorCode.ERR_AUTH_UNAUTHORIZED);
    }

    // Get current balances
    const balances = await Treasury.getBalances();

    console.log('[Treasury Auto-Withdraw] Current balances:', balances);

    // Check if withdrawal is needed (onChainUsdc is the on-chain USDC balance)
    if (balances.onChainUsdc >= MIN_TREASURY_BALANCE) {
      return NextResponse.json({
        success: true,
        message: 'Treasury balance sufficient, no withdrawal needed',
        data: {
          currentBalance: balances.onChainUsdc,
          threshold: MIN_TREASURY_BALANCE,
        },
      });
    }

    // Check if Pacifica has funds to withdraw
    if (balances.pacificaBalance <= 0) {
      console.warn('[Treasury Auto-Withdraw] No funds in Pacifica account to withdraw');
      return NextResponse.json({
        success: true,
        message: 'No funds in Pacifica account to withdraw',
        data: {
          treasuryBalance: balances.onChainUsdc,
          pacificaBalance: balances.pacificaBalance,
        },
      });
    }

    // Calculate withdrawal amount
    const neededAmount = TARGET_TREASURY_BALANCE - balances.onChainUsdc;
    const withdrawAmount = Math.min(neededAmount, balances.pacificaBalance);

    if (withdrawAmount < 1) {
      return NextResponse.json({
        success: true,
        message: 'Withdrawal amount too small',
        data: {
          neededAmount,
          availableInPacifica: balances.pacificaBalance,
        },
      });
    }

    console.log('[Treasury Auto-Withdraw] Initiating withdrawal:', {
      amount: withdrawAmount,
      treasuryBalance: balances.onChainUsdc,
      pacificaBalance: balances.pacificaBalance,
    });

    // Perform withdrawal
    const result = await Treasury.withdrawFromPacifica(withdrawAmount);

    if (result.success) {
      console.log('[Treasury Auto-Withdraw] Withdrawal successful');
      return NextResponse.json({
        success: true,
        message: 'Withdrawal initiated successfully',
        data: {
          withdrawnAmount: withdrawAmount,
          previousBalance: balances.onChainUsdc,
          expectedBalance: balances.onChainUsdc + withdrawAmount,
        },
      });
    } else {
      console.error('[Treasury Auto-Withdraw] Withdrawal failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Withdrawal failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Treasury Auto-Withdraw] Error:', error);
    return errorResponse(error);
  }
}

/**
 * GET /api/internal/treasury/auto-withdraw
 * Check treasury status (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify internal API secret
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!INTERNAL_API_SECRET || token !== INTERNAL_API_SECRET) {
      throw new UnauthorizedError('Unauthorized', ErrorCode.ERR_AUTH_UNAUTHORIZED);
    }

    const balances = await Treasury.getBalances();

    return NextResponse.json({
      success: true,
      data: {
        treasuryAddress: Treasury.getTreasuryAddress(),
        balances,
        thresholds: {
          minBalance: MIN_TREASURY_BALANCE,
          targetBalance: TARGET_TREASURY_BALANCE,
        },
        needsWithdrawal: balances.onChainUsdc < MIN_TREASURY_BALANCE,
      },
    });
  } catch (error) {
    console.error('[Treasury Status] Error:', error);
    return errorResponse(error);
  }
}
