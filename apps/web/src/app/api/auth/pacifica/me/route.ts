/**
 * Get current user's Pacifica connection status
 * GET /api/auth/pacifica/me?tradingWallet=<address>
 *
 * If tradingWallet is provided, uses that address to check/link Pacifica.
 * This allows users to connect a different Solana wallet for trading
 * than the one they authenticated with.
 *
 * If no connection exists in the database, retries auto-linking
 * by checking the Pacifica API with the trading wallet address.
 */
import { withAuth } from '@/lib/server/auth';
import * as AuthService from '@/lib/server/services/auth';
import { errorResponse } from '@/lib/server/errors';

// Rate limit auto-link retries: max once per 10 seconds per user
const lastRetryAttempt = new Map<string, number>();
const RETRY_INTERVAL_MS = 10_000;

export async function GET(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      const { searchParams } = new URL(request.url);
      // Use tradingWallet param if provided, otherwise fall back to JWT wallet
      const walletToCheck = searchParams.get('tradingWallet') || user.walletAddress;

      let connection = await AuthService.getConnection(user.userId);

      // Check if we need to re-link: no connection, inactive, or wallet changed
      const needsRelink = !connection || !connection.isActive ||
        (walletToCheck && connection.accountAddress !== walletToCheck);

      if (needsRelink) {
        const lastAttempt = lastRetryAttempt.get(user.userId) || 0;
        const now = Date.now();

        if (now - lastAttempt > RETRY_INTERVAL_MS) {
          lastRetryAttempt.set(user.userId, now);
          // Try up to 2 attempts to link Pacifica account
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const result = await AuthService.linkPacificaAccount(user.userId, walletToCheck);
              if (result.connected) {
                connection = await AuthService.getConnection(user.userId);
                // Clear from retry map on success
                lastRetryAttempt.delete(user.userId);
                break;
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Unknown error';
              console.warn('Pacifica auto-link retry failed', {
                userId: user.userId,
                tradingWallet: walletToCheck.slice(0, 8) + '...',
                attempt,
                error: errMsg,
              });
              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 1000));
              }
            }
          }
        }
      }

      if (!connection || !connection.isActive) {
        return {
          connected: false,
          pacificaAddress: null,
        };
      }

      return {
        connected: connection.isActive,
        pacificaAddress: connection.accountAddress,
        connectedAt: connection.connectedAt.toISOString(),
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
