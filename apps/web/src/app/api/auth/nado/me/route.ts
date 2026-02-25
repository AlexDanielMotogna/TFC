/**
 * Nado connection status endpoint
 * GET /api/auth/nado/me - Return connection status for authenticated user
 *
 * Accepts optional ?evmAddress=0x... query param for address auto-sync.
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';

function isEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function GET(request: Request) {
  return withAuth(request, async ({ userId }) => {
    const url = new URL(request.url);
    const evmAddress = url.searchParams.get('evmAddress');

    const connection = await prisma.exchangeConnection.findFirst({
      where: {
        userId,
        exchangeType: 'nado',
        isActive: true,
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
    // Since the linked signer was approved for the old address, we must also
    // reset agentApproved and clear the encrypted key to force re-setup.
    if (connection && evmAddress && isEvmAddress(evmAddress)) {
      const storedAddr = connection.accountAddress?.toLowerCase();
      const newAddr = evmAddress.toLowerCase();

      if (storedAddr !== newAddr) {
        console.log(
          `[Nado/me] Auto-syncing accountAddress for user ${userId}: ${storedAddr?.slice(0, 10)}... → ${newAddr.slice(0, 10)}... (resetting linked signer)`
        );
        await prisma.exchangeConnection.update({
          where: { id: connection.id },
          data: {
            accountAddress: newAddr,
            agentApproved: false,
            encryptedKeyData: null,
          },
        });
        connection.accountAddress = newAddr;
        connection.agentApproved = false;
      }
    }

    return Response.json({
      success: true,
      connected: !!connection?.isActive,
      agentApproved: connection?.agentApproved ?? false,
      accountAddress: connection?.accountAddress ?? null,
    });
  });
}
