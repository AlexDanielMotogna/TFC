/**
 * Hyperliquid Agent Wallet Setup
 * POST  — Generate agent wallet, return EIP-712 typed data for user to sign
 * PUT   — Receive user's signature, submit approveAgent to HL API, store encrypted key
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { encryptKey } from '@/lib/server/key-vault';
import { Wallet } from 'ethers';

const HL_API_URL = process.env.NEXT_PUBLIC_HL_API_URL || 'https://api.hyperliquid-testnet.xyz';
const HL_CHAIN = process.env.NEXT_PUBLIC_HL_CHAIN || 'Testnet';
const HL_CHAIN_ID = HL_CHAIN === 'Mainnet' ? 42161 : 421614; // Arbitrum One vs Sepolia
const HL_CHAIN_ID_HEX = HL_CHAIN === 'Mainnet' ? '0xa4b1' : '0x66eee';

// EIP-712 domain for user-signed HL transactions
const TYPED_DATA_DOMAIN = {
  name: 'HyperliquidSignTransaction',
  version: '1',
  chainId: HL_CHAIN_ID,
  verifyingContract: '0x0000000000000000000000000000000000000000' as const,
};

const APPROVE_AGENT_TYPES = {
  'HyperliquidTransaction:ApproveAgent': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'agentAddress', type: 'address' },
    { name: 'agentName', type: 'string' },
    { name: 'nonce', type: 'uint64' },
  ],
} as const;

function splitSignature(sig: string): { r: string; s: string; v: number } {
  const raw = sig.startsWith('0x') ? sig.slice(2) : sig;
  return {
    r: '0x' + raw.slice(0, 64),
    s: '0x' + raw.slice(64, 128),
    v: parseInt(raw.slice(128, 130), 16),
  };
}

// POST: Generate agent wallet + return EIP-712 typed data
export async function POST(request: Request) {
  return withAuth(request, async ({ userId }) => {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return Response.json({ success: false, error: 'walletAddress is required' }, { status: 400 });
    }

    // Validate EVM address format (must start with 0x, 42 chars)
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      return Response.json({ success: false, error: 'walletAddress must be an EVM address (0x...)' }, { status: 400 });
    }

    // Generate new agent wallet
    const agentWallet = Wallet.createRandom();
    const agentAddress = agentWallet.address;
    const nonce = Date.now();

    // Store agent key temporarily in the connection (encrypted, not yet approved)
    const encryptedKey = encryptKey(agentWallet.privateKey);

    await prisma.exchangeConnection.upsert({
      where: { userId_exchangeType: { userId, exchangeType: 'hyperliquid' } },
      create: {
        userId,
        exchangeType: 'hyperliquid',
        accountAddress: walletAddress.toLowerCase(),
        vaultKeyReference: 'pending-approval',
        encryptedKeyData: encryptedKey,
        agentApproved: false,
        isActive: false,
      },
      update: {
        accountAddress: walletAddress.toLowerCase(),
        encryptedKeyData: encryptedKey,
        agentApproved: false,
        isActive: false,
      },
    });

    // Build EIP-712 typed data for wagmi's signTypedData
    // Note: nonce is sent as a number in JSON (BigInt can't be serialized).
    // The frontend must convert it to BigInt when calling signTypedData.
    const typedData = {
      domain: TYPED_DATA_DOMAIN,
      types: APPROVE_AGENT_TYPES,
      primaryType: 'HyperliquidTransaction:ApproveAgent' as const,
      message: {
        hyperliquidChain: HL_CHAIN,
        agentAddress: agentAddress as `0x${string}`,
        agentName: 'TFC',
        nonce,
      },
    };

    return Response.json({
      success: true,
      typedData,
      agentAddress,
      nonce,
    });
  });
}

// PUT: Submit signed approveAgent to Hyperliquid API
export async function PUT(request: Request) {
  return withAuth(request, async ({ userId }) => {
    const body = await request.json();
    const { signature, agentAddress, nonce } = body;

    if (!signature || !agentAddress || !nonce) {
      return Response.json({ success: false, error: 'signature, agentAddress, and nonce are required' }, { status: 400 });
    }

    // Get the connection to verify it exists
    const connection = await prisma.exchangeConnection.findUnique({
      where: { userId_exchangeType: { userId, exchangeType: 'hyperliquid' } },
    });

    if (!connection) {
      return Response.json({ success: false, error: 'No pending Hyperliquid setup found' }, { status: 404 });
    }

    // Split signature for HL API format
    const { r, s, v } = splitSignature(signature);

    // Submit approveAgent to Hyperliquid API
    // agentName must match what was signed in the EIP-712 message
    const hlPayload = {
      action: {
        type: 'approveAgent',
        hyperliquidChain: HL_CHAIN,
        signatureChainId: HL_CHAIN_ID_HEX,
        agentAddress,
        agentName: 'TFC',
        nonce,
      },
      nonce,
      signature: { r, s, v },
    };

    console.log('Submitting approveAgent to Hyperliquid:', {
      userId,
      agentAddress: agentAddress.slice(0, 8) + '...',
      chain: HL_CHAIN,
    });

    const hlRes = await fetch(`${HL_API_URL}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hlPayload),
    });

    const hlResult = await hlRes.json();

    if (!hlRes.ok || hlResult.status === 'err') {
      console.error('Hyperliquid approveAgent failed:', hlResult);
      return Response.json({
        success: false,
        error: hlResult.response || 'Hyperliquid rejected agent approval',
      }, { status: 502 });
    }

    // Mark connection as approved and active
    await prisma.exchangeConnection.update({
      where: { userId_exchangeType: { userId, exchangeType: 'hyperliquid' } },
      data: {
        vaultKeyReference: 'agent-wallet',
        agentApproved: true,
        isActive: true,
      },
    });

    console.log('Hyperliquid agent approved successfully', {
      userId,
      agentAddress: agentAddress.slice(0, 8) + '...',
    });

    return Response.json({ success: true });
  });
}
