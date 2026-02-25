/**
 * Nado Linked Signer Setup
 * POST — Generate linked signer key pair, return EIP-712 typed data for user to sign
 * PUT  — Receive user's signature, submit link_signer to Nado Gateway, store encrypted key
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { decryptKey, encryptKey } from '@/lib/server/key-vault';
import { Wallet } from 'ethers';

const NADO_GATEWAY_URL = process.env.NADO_GATEWAY_URL || 'https://gateway.test.nado.xyz/v1';
const NADO_CHAIN_ID = parseInt(process.env.NADO_CHAIN_ID || '763373', 10);

/**
 * Encode an EVM address + subaccount name into bytes32.
 * 20-byte address + 12-byte name (right-padded with zeros).
 */
function addressToSubaccount(address: string, name: string = 'default'): string {
  const addr = address.toLowerCase().replace('0x', '');
  const nameHex = Buffer.from(name).toString('hex').padEnd(24, '0');
  return '0x' + addr + nameHex;
}

/**
 * Pad an address to bytes32 (20-byte address + 12 zero bytes).
 */
function addressToBytes32(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  return '0x' + addr.padEnd(64, '0');
}

/** Fetch the endpoint contract address from Nado. */
async function getEndpointAddr(): Promise<string> {
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
    const text = await resp.text().catch(() => 'unknown');
    throw new Error(`Nado contracts query failed (${resp.status}): ${text}`);
  }
  const result = (await resp.json()) as {
    status: string;
    data: { endpoint_addr: string };
  };
  if (result.status !== 'success' || !result.data?.endpoint_addr) {
    throw new Error(`Nado contracts query returned unexpected data: ${JSON.stringify(result)}`);
  }
  return result.data.endpoint_addr;
}

/** Fetch the current tx_nonce for an address from Nado Gateway. */
async function getTxNonce(address: string): Promise<number> {
  const resp = await fetch(`${NADO_GATEWAY_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    body: JSON.stringify({ type: 'nonces', address: address.toLowerCase() }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) return 0;
  const result = (await resp.json()) as {
    status: string;
    data: { tx_nonce: string };
  };
  if (result.status !== 'success') return 0;
  return parseInt(result.data.tx_nonce, 10) || 0;
}

// EIP-712 domain for Nado
function getNadoDomain(verifyingContract: string) {
  return {
    name: 'Nado',
    version: '0.0.1',
    chainId: NADO_CHAIN_ID,
    verifyingContract,
  };
}

const LINK_SIGNER_TYPES = {
  LinkSigner: [
    { name: 'sender', type: 'bytes32' },
    { name: 'signer', type: 'bytes32' },
    { name: 'nonce', type: 'uint64' },
  ],
} as const;

// POST: Generate linked signer key pair + return EIP-712 typed data
export async function POST(request: Request) {
  return withAuth(request, async ({ userId }) => {
    try {
      const body = await request.json();
      const { walletAddress } = body;

      if (!walletAddress) {
        return Response.json(
          { success: false, error: 'walletAddress is required' },
          { status: 400 }
        );
      }

      if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        return Response.json(
          { success: false, error: 'walletAddress must be an EVM address (0x...)' },
          { status: 400 }
        );
      }

      const normalizedAddress = walletAddress.toLowerCase();

      // Check for existing connection
      const existing = await prisma.exchangeConnection.findUnique({
        where: { userId_exchangeType: { userId, exchangeType: 'nado' } },
      });

      // If already approved for this address, return status — no need to regenerate
      if (existing && existing.agentApproved && existing.accountAddress === normalizedAddress) {
        return Response.json({
          success: true,
          alreadyApproved: true,
          signerAddress: null,
          message: 'Linked signer already approved for this address',
        });
      }

      let signerAddress: string;
      let encryptedKey: string;

      if (
        existing &&
        existing.encryptedKeyData &&
        !existing.agentApproved &&
        existing.accountAddress === normalizedAddress
      ) {
        // Reuse the existing key pair (avoid orphaning a linked signer the
        // user may have already approved on-chain but hasn't PUT yet)
        const privateKey = decryptKey(existing.encryptedKeyData);
        const existingWallet = new Wallet(privateKey);
        signerAddress = existingWallet.address;
        encryptedKey = existing.encryptedKeyData;
      } else {
        // Generate new linked signer key pair (no connection, different
        // address, or previously approved for a different address)
        const signerWallet = Wallet.createRandom();
        signerAddress = signerWallet.address;
        encryptedKey = encryptKey(signerWallet.privateKey);
      }

      // Fetch the current tx_nonce from Nado (increments with each link_signer call)
      const nonce = await getTxNonce(walletAddress);

      await prisma.exchangeConnection.upsert({
        where: { userId_exchangeType: { userId, exchangeType: 'nado' } },
        create: {
          userId,
          exchangeType: 'nado',
          accountAddress: normalizedAddress,
          vaultKeyReference: 'pending-approval',
          encryptedKeyData: encryptedKey,
          agentApproved: false,
          isActive: false,
        },
        update: {
          accountAddress: normalizedAddress,
          encryptedKeyData: encryptedKey,
          agentApproved: false,
          isActive: false,
        },
      });

      // Fetch endpoint contract for verifying contract
      const endpointAddr = await getEndpointAddr();

      // Build subaccount bytes32 (user's wallet + "default")
      const subaccount = addressToSubaccount(walletAddress);
      // Signer as bytes32 (address padded to 32 bytes)
      const signerBytes32 = addressToBytes32(signerAddress);

      // Build EIP-712 typed data for wagmi's signTypedData
      const typedData = {
        domain: getNadoDomain(endpointAddr),
        types: LINK_SIGNER_TYPES,
        primaryType: 'LinkSigner' as const,
        message: {
          sender: subaccount,
          signer: signerBytes32,
          nonce,
        },
      };

      return Response.json({
        success: true,
        typedData,
        signerAddress,
        subaccount,
        nonce,
      });
    } catch (error) {
      console.error('[Nado Setup POST] Error:', error);
      const msg = error instanceof Error ? error.message : 'Internal server error';
      return Response.json({ success: false, error: msg }, { status: 500 });
    }
  });
}

// PUT: Submit signed link_signer to Nado Gateway
export async function PUT(request: Request) {
  return withAuth(request, async ({ userId }) => {
    try {
      const body = await request.json();
      const { signature, signerAddress, subaccount, nonce } = body;

      if (!signature || !signerAddress || !subaccount) {
        return Response.json(
          {
            success: false,
            error: 'signature, signerAddress, and subaccount are required',
          },
          { status: 400 }
        );
      }

      // Get the connection to verify it exists
      const connection = await prisma.exchangeConnection.findUnique({
        where: { userId_exchangeType: { userId, exchangeType: 'nado' } },
      });

      if (!connection) {
        return Response.json(
          { success: false, error: 'No pending Nado setup found' },
          { status: 404 }
        );
      }

      // Signer as bytes32
      const signerBytes32 = addressToBytes32(signerAddress);

      // Submit link_signer to Nado Gateway
      const nadoPayload = {
        link_signer: {
          tx: {
            sender: subaccount,
            signer: signerBytes32,
            nonce: String(nonce ?? 0),
          },
          signature,
        },
      };

      console.log('Submitting link_signer to Nado:', {
        userId,
        signerAddress: signerAddress.slice(0, 8) + '...',
      });

      const nadoRes = await fetch(`${NADO_GATEWAY_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        body: JSON.stringify(nadoPayload),
      });

      const nadoText = await nadoRes.text();
      let nadoResult: Record<string, unknown>;
      try {
        nadoResult = JSON.parse(nadoText);
      } catch {
        console.error('Nado link_signer non-JSON response:', nadoText.slice(0, 500));
        return Response.json(
          { success: false, error: `Nado returned non-JSON: ${nadoText.slice(0, 200)}` },
          { status: 502 }
        );
      }

      if (!nadoRes.ok || nadoResult.status === 'failure') {
        console.error('Nado link_signer failed:', nadoResult);
        return Response.json(
          {
            success: false,
            error:
              (nadoResult.error as string) ||
              (nadoResult.reason as string) ||
              'Nado rejected linked signer approval',
          },
          { status: 502 }
        );
      }

      // Mark connection as approved and active
      await prisma.exchangeConnection.update({
        where: { userId_exchangeType: { userId, exchangeType: 'nado' } },
        data: {
          vaultKeyReference: 'linked-signer',
          agentApproved: true,
          isActive: true,
        },
      });

      console.log('Nado linked signer approved successfully', {
        userId,
        signerAddress: signerAddress.slice(0, 8) + '...',
      });

      return Response.json({ success: true });
    } catch (error) {
      console.error('[Nado Setup PUT] Error:', error);
      const msg = error instanceof Error ? error.message : 'Internal server error';
      return Response.json({ success: false, error: msg }, { status: 500 });
    }
  });
}
