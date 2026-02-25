/**
 * Nado WebSocket Authentication
 * POST /api/nado/ws-auth
 *
 * Generates a signed StreamAuthentication EIP-712 message that the client-side
 * WS adapter can send to authenticate the `order_update` stream.
 *
 * The linked signer private key is stored encrypted in the DB; only the server
 * can decrypt and sign. The client calls this endpoint, receives the ready-made
 * { method, tx, signature } payload, and sends it verbatim over the WS.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { decryptKey } from '@/lib/server/key-vault';

const NADO_GATEWAY_URL = process.env.NADO_GATEWAY_URL || 'https://gateway.test.nado.xyz/v1';
const NADO_CHAIN_ID = parseInt(process.env.NADO_CHAIN_ID || '763373', 10);

// Cache endpoint address (rarely changes)
let cachedEndpointAddr: string | null = null;

async function getEndpointAddr(): Promise<string> {
  if (cachedEndpointAddr) return cachedEndpointAddr;

  const resp = await fetch(`${NADO_GATEWAY_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    body: JSON.stringify({ type: 'contracts' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) {
    throw new Error(`Nado contracts query failed (${resp.status})`);
  }
  const result = (await resp.json()) as {
    status: string;
    data: { endpoint_addr: string };
  };
  if (result.status !== 'success' || !result.data?.endpoint_addr) {
    throw new Error('Nado contracts query returned unexpected data');
  }
  cachedEndpointAddr = result.data.endpoint_addr;
  return cachedEndpointAddr;
}

function addressToSubaccount(address: string, name: string = 'default'): string {
  const addr = address.toLowerCase().replace('0x', '');
  const nameHex = Buffer.from(name).toString('hex').padEnd(24, '0');
  return '0x' + addr + nameHex;
}

const STREAM_AUTH_TYPES = {
  StreamAuthentication: [
    { name: 'sender', type: 'bytes32' },
    { name: 'expiration', type: 'uint64' },
  ],
};

export async function POST(req: NextRequest) {
  return withAuth(req, async ({ userId }) => {
    try {
      const body = await req.json();
      const { walletAddress } = body;

      if (!walletAddress || !walletAddress.startsWith('0x')) {
        return NextResponse.json(
          { success: false, error: 'walletAddress is required' },
          { status: 400 }
        );
      }

      const normalizedAddress = walletAddress.toLowerCase();

      // Look up the active Nado connection with the linked signer key
      const connection = await prisma.exchangeConnection.findFirst({
        where: {
          userId,
          exchangeType: 'nado',
          accountAddress: normalizedAddress,
          isActive: true,
          agentApproved: true,
        },
        select: { encryptedKeyData: true },
      });

      if (!connection?.encryptedKeyData) {
        return NextResponse.json(
          { success: false, error: 'No approved Nado linked signer found' },
          { status: 404 }
        );
      }

      // Decrypt the linked signer key and create a wallet
      const privateKey = decryptKey(connection.encryptedKeyData);
      const wallet = new ethers.Wallet(privateKey);

      // Build the StreamAuthentication EIP-712 message
      const endpointAddr = await getEndpointAddr();
      const subaccount = addressToSubaccount(normalizedAddress);
      const expiration = Math.floor(Date.now() / 1000) + 100; // ~100 seconds

      const domain: ethers.TypedDataDomain = {
        name: 'Nado',
        version: '0.0.1',
        chainId: NADO_CHAIN_ID,
        verifyingContract: endpointAddr,
      };

      const message = {
        sender: subaccount,
        expiration: BigInt(expiration),
      };

      const signature = await wallet.signTypedData(domain, STREAM_AUTH_TYPES, message);

      // Return the ready-to-send WS payload
      return NextResponse.json({
        success: true,
        payload: {
          method: 'authenticate',
          tx: {
            sender: subaccount,
            expiration: String(expiration),
          },
          signature,
        },
      });
    } catch (error) {
      console.error('[NadoWsAuth] Error:', error);
      const msg = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
  });
}
