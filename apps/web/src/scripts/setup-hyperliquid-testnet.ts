/**
 * Hyperliquid Testnet Setup Script
 *
 * This script helps you set up a Hyperliquid testnet account for trading tests.
 * It generates an agent wallet, helps you approve it, and stores the encrypted key.
 *
 * Usage:
 *   npx tsx apps/web/src/scripts/setup-hyperliquid-testnet.ts --key=YOUR_PRIVATE_KEY
 *
 * Prerequisites:
 *   1. An EVM wallet (MetaMask, etc.) with a private key
 *   2. EXCHANGE_KEY_ENCRYPTION_SECRET in .env.local (or this script generates one)
 *   3. DATABASE_URL in .env (for storing the connection)
 *
 * Steps this script performs:
 *   1. Generate a random agent wallet (ECDSA keypair)
 *   2. Show you how to get testnet funds
 *   3. Send approveAgent transaction (signs with YOUR wallet)
 *   4. Store encrypted agent key in ExchangeConnection table
 */

import { ethers } from 'ethers';
import * as crypto from 'crypto';
import * as readline from 'readline';

const HL_TESTNET_API = 'https://api.hyperliquid-testnet.xyz';

// Ensure we're using testnet
process.env.HYPERLIQUID_API_URL = HL_TESTNET_API;

// ─── Interactive prompts ──────────────────────────────────────

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

// ─── EIP-712 signing for approveAgent ─────────────────────────

const USER_SIGNED_DOMAIN: ethers.TypedDataDomain = {
  name: 'HyperliquidSignTransaction',
  version: '1',
  chainId: 421614, // 0x66eee — Arbitrum Sepolia
  verifyingContract: '0x0000000000000000000000000000000000000000',
};

const APPROVE_AGENT_TYPES = {
  'HyperliquidTransaction:ApproveAgent': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'agentAddress', type: 'address' },
    { name: 'agentName', type: 'string' },
    { name: 'nonce', type: 'uint64' },
  ],
};

const APPROVE_BUILDER_FEE_TYPES = {
  'HyperliquidTransaction:ApproveBuilderFee': [
    { name: 'hyperliquidChain', type: 'string' },
    { name: 'maxFeeRate', type: 'string' },
    { name: 'builder', type: 'address' },
    { name: 'nonce', type: 'uint64' },
  ],
};

function splitSignature(sig: string): { r: string; s: string; v: number } {
  const raw = sig.startsWith('0x') ? sig.slice(2) : sig;
  return {
    r: '0x' + raw.slice(0, 64),
    s: '0x' + raw.slice(64, 128),
    v: parseInt(raw.slice(128, 130), 16),
  };
}

// ─── Main setup flow ──────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Hyperliquid Testnet Setup');
  console.log('  API: ' + HL_TESTNET_API);
  console.log('═══════════════════════════════════════════════════\n');

  const rl = createReadline();

  try {
    // ─── Step 1: Encryption secret ────────────────────────────
    console.log('━━━ Step 1: Encryption Secret ━━━\n');

    let encryptionSecret = process.env.EXCHANGE_KEY_ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      encryptionSecret = crypto.randomBytes(32).toString('hex');
      console.log('Generated new encryption secret (add to .env.local):');
      console.log(`\n  EXCHANGE_KEY_ENCRYPTION_SECRET=${encryptionSecret}\n`);

      const proceed = await ask(rl, 'Have you saved this to .env.local? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('Please save the encryption secret first and re-run.');
        process.exit(0);
      }
      // Set it for this session
      process.env.EXCHANGE_KEY_ENCRYPTION_SECRET = encryptionSecret;
    } else {
      console.log('✓ Encryption secret found in environment.\n');
    }

    // ─── Step 2: Your wallet ──────────────────────────────────
    console.log('━━━ Step 2: Your Main Wallet ━━━\n');

    // Accept private key via --key= argument to avoid terminal paste issues
    const keyArg = process.argv.find(a => a.startsWith('--key='));
    let mainPrivateKey: string;

    if (keyArg) {
      mainPrivateKey = keyArg.split('=')[1] || keyArg;
    } else {
      console.log('Enter the private key of the wallet you want to use on Hyperliquid testnet.');
      console.log('⚠ This key is only used locally for signing. It is NOT stored anywhere.\n');
      console.log('TIP: If pasting fails, use: --key=YOUR_PRIVATE_KEY as a command argument\n');
      mainPrivateKey = await ask(rl, 'Main wallet private key: ');
    }

    // Auto-add 0x prefix if missing
    if (!mainPrivateKey.startsWith('0x')) {
      mainPrivateKey = '0x' + mainPrivateKey;
    }
    if (mainPrivateKey.length !== 66 || !/^0x[0-9a-fA-F]{64}$/.test(mainPrivateKey)) {
      console.error(`Invalid private key format. Got ${mainPrivateKey.length} chars, need 66 (0x + 64 hex).`);
      process.exit(1);
    }

    const mainWallet = new ethers.Wallet(mainPrivateKey);
    const mainAddress = mainWallet.address;
    console.log(`\n✓ Main wallet: ${mainAddress}\n`);

    // ─── Step 3: Check testnet balance ────────────────────────
    console.log('━━━ Step 3: Testnet Funds ━━━\n');

    const stateResp = await fetch(`${HL_TESTNET_API}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: mainAddress }),
    });
    const state = await stateResp.json() as {
      marginSummary: { accountValue: string; totalRawUsd: string };
    };
    const balance = parseFloat(state.marginSummary.totalRawUsd);

    if (balance > 0) {
      console.log(`✓ Testnet balance: $${balance}\n`);
    } else {
      console.log('No testnet funds found. To get testnet USDC:');
      console.log('  1. Go to https://app.hyperliquid-testnet.xyz');
      console.log('  2. Connect your wallet');
      console.log('  3. Request testnet funds from the faucet');
      console.log(`  4. Your address: ${mainAddress}\n`);

      const proceed = await ask(rl, 'Have you deposited testnet funds? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('\nPlease deposit testnet funds first and re-run.');
        process.exit(0);
      }
    }

    // ─── Step 4: Generate agent wallet ────────────────────────
    console.log('━━━ Step 4: Agent Wallet ━━━\n');

    const agentWallet = ethers.Wallet.createRandom();
    console.log(`Generated agent wallet:`);
    console.log(`  Address: ${agentWallet.address}`);
    console.log(`  Private key: ${agentWallet.privateKey.slice(0, 10)}...${agentWallet.privateKey.slice(-4)} (will be encrypted)\n`);

    // ─── Step 5: Approve agent on Hyperliquid ─────────────────
    console.log('━━━ Step 5: Approve Agent ━━━\n');

    const nonce = Date.now();
    const approveAgentMsg = {
      hyperliquidChain: 'Testnet',
      agentAddress: agentWallet.address,
      agentName: 'TradeClub',
      nonce: BigInt(nonce),
    };

    console.log('Signing approveAgent transaction...');
    const approveAgentSig = await mainWallet.signTypedData(
      USER_SIGNED_DOMAIN,
      APPROVE_AGENT_TYPES,
      approveAgentMsg,
    );
    const agentSigParts = splitSignature(approveAgentSig);

    // Submit approveAgent
    // signatureChainId is REQUIRED in the action body for user-signed actions
    const approveBody = {
      action: {
        type: 'approveAgent',
        hyperliquidChain: 'Testnet',
        signatureChainId: '0x66eee',
        agentAddress: agentWallet.address,
        agentName: 'TradeClub',
        nonce,
      },
      nonce,
      signature: agentSigParts,
    };

    console.log('Submitting approveAgent to Hyperliquid testnet...');
    console.log('Request body:', JSON.stringify(approveBody, null, 2));

    const approveResp = await fetch(`${HL_TESTNET_API}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approveBody),
    });

    const approveText = await approveResp.text();
    console.log('Response status:', approveResp.status);
    console.log('Response body:', approveText);

    let approveResult: { status: string; response?: unknown };
    try {
      approveResult = JSON.parse(approveText);
    } catch {
      console.error('\n✗ Non-JSON response from Hyperliquid:', approveText);
      process.exit(1);
    }

    if (approveResult.status === 'ok') {
      console.log('\n✓ Agent approved successfully!\n');
    } else {
      console.error('\n✗ Failed to approve agent:', approveText);
      console.log('\nYou may need to try again or check the Hyperliquid testnet status.');
      process.exit(1);
    }

    // ─── Step 6: Encrypt and store key ────────────────────────
    console.log('━━━ Step 6: Store Encrypted Key ━━━\n');

    const { encryptKey } = await import('../lib/server/key-vault');
    const encryptedKey = encryptKey(agentWallet.privateKey);
    console.log(`Encrypted key: ${encryptedKey.slice(0, 20)}...`);

    // Store in database
    const { prisma } = await import('@tfc/db');

    // Check if user exists or create a test user
    let userId: string;
    const existingConnection = await prisma.exchangeConnection.findFirst({
      where: { accountAddress: mainAddress.toLowerCase() },
      select: { userId: true, id: true },
    });

    if (existingConnection) {
      userId = existingConnection.userId;
      console.log(`Updating existing connection for user ${userId}...`);
      await prisma.exchangeConnection.update({
        where: { id: existingConnection.id },
        data: {
          exchangeType: 'hyperliquid',
          encryptedKeyData: encryptedKey,
          agentApproved: true,
          isActive: true,
        },
      });
    } else {
      // Look for any user to link to, or create one
      const anyUser = await prisma.user.findFirst({ select: { id: true } });
      if (anyUser) {
        userId = anyUser.id;
      } else {
        // Create a test user
        const testUser = await prisma.user.create({
          data: {
            walletAddress: mainAddress.toLowerCase(),
            handle: 'hl-testnet',
          },
        });
        userId = testUser.id;
      }

      console.log(`Upserting ExchangeConnection for user ${userId}...`);
      await prisma.exchangeConnection.upsert({
        where: { userId_exchangeType: { userId, exchangeType: 'hyperliquid' } },
        update: {
          accountAddress: mainAddress.toLowerCase(),
          vaultKeyReference: 'agent-wallet',
          encryptedKeyData: encryptedKey,
          agentApproved: true,
          isActive: true,
        },
        create: {
          userId,
          exchangeType: 'hyperliquid',
          accountAddress: mainAddress.toLowerCase(),
          vaultKeyReference: 'agent-wallet',
          encryptedKeyData: encryptedKey,
          agentApproved: true,
          builderApproved: false,
          isActive: true,
          isPrimary: true,
        },
      });
    }

    console.log('✓ Agent wallet encrypted and stored in database.\n');

    // ─── Step 7: Verify ───────────────────────────────────────
    console.log('━━━ Step 7: Verification ━━━\n');

    // Verify we can decrypt
    const { decryptKey } = await import('../lib/server/key-vault');
    const decryptedKey = decryptKey(encryptedKey);
    const verified = decryptedKey === agentWallet.privateKey;
    console.log(`Key encryption/decryption: ${verified ? '✓ PASS' : '✗ FAIL'}`);

    // Verify agent wallet can be loaded
    const verifyWallet = new ethers.Wallet(decryptedKey);
    console.log(`Agent wallet reconstruction: ${verifyWallet.address === agentWallet.address ? '✓ PASS' : '✗ FAIL'}`);

    // ─── Summary ──────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Setup Complete!');
    console.log('═══════════════════════════════════════════════════\n');
    console.log(`Main wallet:  ${mainAddress}`);
    console.log(`Agent wallet: ${agentWallet.address}`);
    console.log(`Exchange:     Hyperliquid Testnet`);
    console.log(`Status:       Agent approved, key encrypted in DB`);
    console.log('\nNext steps:');
    console.log('  1. Make sure EXCHANGE_KEY_ENCRYPTION_SECRET is in .env.local');
    console.log('  2. Make sure HYPERLIQUID_API_URL=https://api.hyperliquid-testnet.xyz is in .env.local');
    console.log(`  3. Run trading tests:`);
    console.log(`     npx tsx apps/web/src/scripts/test-hyperliquid.ts --testnet --trade --account=${mainAddress}`);
    console.log('');

  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
