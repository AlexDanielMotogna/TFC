/**
 * Hyperliquid connection status endpoint
 * GET /api/auth/hyperliquid/me - Return connection status for authenticated user
 *
 * Accepts optional ?evmAddress=0x... query param. When the stored accountAddress
 * doesn't match the user's current EVM wallet, the DB record is auto-corrected.
 * This handles the case where a Solana (auth) address was stored instead of the
 * DEX-specific EVM address.
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';

function isEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function GET(request: Request) {
  return withAuth(request, async ({ userId }) => {
    // Check if frontend sent the current EVM wallet address
    const url = new URL(request.url);
    const evmAddress = url.searchParams.get('evmAddress');

    const connection = await prisma.exchangeConnection.findFirst({
      where: {
        userId,
        exchangeType: 'hyperliquid',
      },
      select: {
        id: true,
        accountAddress: true,
        agentApproved: true,
        builderApproved: true,
        isActive: true,
      },
    });

    // Auto-sync: if the frontend reports a valid EVM address and the DB has
    // a different (or non-EVM) address, update the record.
    if (connection && evmAddress && isEvmAddress(evmAddress)) {
      const storedAddr = connection.accountAddress?.toLowerCase();
      const newAddr = evmAddress.toLowerCase();

      if (storedAddr !== newAddr) {
        console.log(`[HL/me] Auto-syncing accountAddress for user ${userId}: ${storedAddr?.slice(0, 10)}... → ${newAddr.slice(0, 10)}...`);
        await prisma.exchangeConnection.update({
          where: { id: connection.id },
          data: { accountAddress: newAddr },
        });
        connection.accountAddress = newAddr;
      }
    }

    return Response.json({
      success: true,
      connected: !!connection?.isActive,
      agentApproved: connection?.agentApproved ?? false,
      builderApproved: connection?.builderApproved ?? false,
      accountAddress: connection?.accountAddress ?? null,
    });
  });
}
