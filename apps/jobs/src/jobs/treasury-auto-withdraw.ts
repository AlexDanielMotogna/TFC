/**
 * Treasury Auto-Withdraw Job
 *
 * Periodically checks the treasury wallet balance and triggers
 * a withdrawal from Pacifica if the balance is too low.
 *
 * This ensures there are always funds available for prize claims.
 */
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';

const logger = createLogger({ service: 'job' });

// Web app URL for internal API calls
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

interface TreasuryResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    currentBalance?: number;
    treasuryBalance?: number;
    pacificaBalance?: number;
    withdrawnAmount?: number;
    previousBalance?: number;
    expectedBalance?: number;
    threshold?: number;
  };
}

/**
 * Check treasury balance and trigger auto-withdraw if needed
 */
export async function autoWithdrawTreasury(): Promise<void> {
  if (!INTERNAL_API_SECRET) {
    logger.error(
      LOG_EVENTS.TREASURY_WITHDRAW_FAILURE,
      'INTERNAL_API_SECRET not configured'
    );
    return;
  }

  try {
    const response = await fetch(`${WEB_APP_URL}/api/internal/treasury/auto-withdraw`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const result: TreasuryResponse = await response.json();

    if (result.success) {
      if (result.data?.withdrawnAmount) {
        logger.info(LOG_EVENTS.TREASURY_WITHDRAW_SUCCESS, 'Treasury auto-withdraw completed', {
          withdrawnAmount: result.data.withdrawnAmount,
          previousBalance: result.data.previousBalance,
          expectedBalance: result.data.expectedBalance,
        });
      } else {
        // No withdrawal needed, just log at debug level
        logger.debug?.(LOG_EVENTS.TREASURY_WITHDRAW_SUCCESS, result.message || 'No withdrawal needed', {
          currentBalance: result.data?.currentBalance,
          threshold: result.data?.threshold,
        });
      }
    } else {
      logger.error(LOG_EVENTS.TREASURY_WITHDRAW_FAILURE, 'Treasury auto-withdraw failed', {
        error: result.error,
      });
    }
  } catch (error) {
    logger.error(LOG_EVENTS.TREASURY_WITHDRAW_FAILURE, 'Treasury auto-withdraw request failed', error as Error);
  }
}

/**
 * Get current treasury status (for monitoring)
 */
export async function getTreasuryStatus(): Promise<TreasuryResponse | null> {
  if (!INTERNAL_API_SECRET) {
    logger.error(
      LOG_EVENTS.TREASURY_STATUS_FAILURE,
      'INTERNAL_API_SECRET not configured'
    );
    return null;
  }

  try {
    const response = await fetch(`${WEB_APP_URL}/api/internal/treasury/auto-withdraw`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
      },
    });

    return await response.json();
  } catch (error) {
    logger.error(LOG_EVENTS.TREASURY_STATUS_FAILURE, 'Failed to get treasury status', error as Error);
    return null;
  }
}
