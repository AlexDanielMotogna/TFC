/**
 * Get current user's Pacifica connection status
 * GET /api/auth/pacifica/me
 *
 * If no connection exists in the database, retries auto-linking
 * by checking the Pacifica API with the user's wallet address.
 * This handles cases where the initial auto-link during login failed
 * (e.g., Pacifica API was temporarily down or rate limited).
 */
import { withAuth } from '@/lib/server/auth';
import * as AuthService from '@/lib/server/services/auth';
import { errorResponse } from '@/lib/server/errors';

// Rate limit auto-link retries: max once per 30 seconds per user
const lastRetryAttempt = new Map<string, number>();
const RETRY_INTERVAL_MS = 30_000;

export async function GET(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      let connection = await AuthService.getConnection(user.userId);

      // If no connection, try to auto-link by checking the Pacifica API
      // Rate limited to avoid hammering Pacifica on every poll
      if (!connection || !connection.isActive) {
        const lastAttempt = lastRetryAttempt.get(user.userId) || 0;
        const now = Date.now();

        if (now - lastAttempt > RETRY_INTERVAL_MS) {
          lastRetryAttempt.set(user.userId, now);
          try {
            const result = await AuthService.linkPacificaAccount(user.userId, user.walletAddress);
            if (result.connected) {
              connection = await AuthService.getConnection(user.userId);
              // Clear from retry map on success
              lastRetryAttempt.delete(user.userId);
            }
          } catch {
            // Pacifica account doesn't exist yet or API error - that's OK
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
