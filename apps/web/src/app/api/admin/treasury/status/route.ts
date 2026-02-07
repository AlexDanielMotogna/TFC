/**
 * Admin Treasury Status API
 * GET /api/admin/treasury/status - Get treasury wallet balances and status
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { errorResponse } from '@/lib/server/errors';
import * as Treasury from '@/lib/server/treasury';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const balances = await Treasury.getBalances();

      // Calculate alert levels
      const usdcWarning = balances.onChainUsdc < 100;
      const usdcCritical = balances.onChainUsdc < 50;
      const solCritical = balances.solBalance < 0.05;

      return Response.json({
        success: true,
        data: {
          treasuryAddress: Treasury.getTreasuryAddress(),
          balances: {
            usdc: balances.onChainUsdc,
            sol: balances.solBalance,
            pacifica: balances.pacificaBalance,
            availableForClaims: balances.availableForClaims,
          },
          alerts: {
            usdcWarning,
            usdcCritical,
            solCritical,
            hasAlert: usdcWarning || usdcCritical || solCritical,
          },
          lastUpdated: new Date().toISOString(),
        },
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
