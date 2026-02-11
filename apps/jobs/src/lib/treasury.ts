/**
 * Treasury Service (Jobs Package)
 *
 * This is a minimal re-export of the treasury service from apps/web.
 * We re-export here to avoid import path issues between packages.
 *
 * TODO: Move treasury to a shared package (@tfc/treasury) to avoid duplication
 */

import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { base58 } from '@scure/base';

// Configuration
const TREASURY_PUBLIC_KEY = 'FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const MIN_SOL_FOR_FEES = 0.01;
const MIN_USDC_BUFFER = 0.10;

export interface TreasuryBalance {
  pacificaBalance: number;
  onChainUsdc: number;
  solBalance: number;
  availableForClaims: number;
}

export interface TransferResult {
  success: boolean;
  signature?: string;
  error?: string;
}

function getTreasuryKeypair(): Keypair {
  const privateKey = process.env.TREASURY_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('TREASURY_PRIVATE_KEY not configured');
  }

  try {
    const secretKey = base58.decode(privateKey);
    return Keypair.fromSecretKey(secretKey);
  } catch {
    throw new Error('Invalid TREASURY_PRIVATE_KEY format');
  }
}

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, 'confirmed');
}

export async function getBalances(): Promise<TreasuryBalance> {
  const connection = getConnection();
  const treasuryPubkey = new PublicKey(TREASURY_PUBLIC_KEY);

  let solBalance = 0;
  try {
    const solBalanceLamports = await connection.getBalance(treasuryPubkey);
    solBalance = solBalanceLamports / 1e9;
  } catch (error) {
    console.warn('Could not fetch SOL balance:', error);
  }

  let onChainUsdc = 0;
  try {
    const usdcAta = await getAssociatedTokenAddress(USDC_MINT, treasuryPubkey);
    const tokenAccount = await getAccount(connection, usdcAta);
    onChainUsdc = Number(tokenAccount.amount) / 1e6;
  } catch (error) {
    console.warn('Could not fetch USDC balance:', error);
  }

  const availableForClaims = onChainUsdc - MIN_USDC_BUFFER;

  return {
    pacificaBalance: 0, // Not needed for payout processor
    onChainUsdc,
    solBalance,
    availableForClaims: Math.max(0, availableForClaims),
  };
}

export async function transferUsdc(
  recipientAddress: string,
  amount: number
): Promise<TransferResult> {
  try {
    if (amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    const balances = await getBalances();

    if (balances.solBalance < MIN_SOL_FOR_FEES) {
      return {
        success: false,
        error: `Insufficient SOL for fees. Need ${MIN_SOL_FOR_FEES} SOL, have ${balances.solBalance.toFixed(4)} SOL`
      };
    }

    if (balances.onChainUsdc < amount) {
      return {
        success: false,
        error: `Insufficient USDC. Need ${amount}, have ${balances.onChainUsdc.toFixed(2)}`
      };
    }

    const connection = getConnection();
    const treasuryKeypair = getTreasuryKeypair();
    const recipientPubkey = new PublicKey(recipientAddress);

    const treasuryAta = await getAssociatedTokenAddress(USDC_MINT, treasuryKeypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

    const transaction = new Transaction();

    // Check if recipient ATA exists, if not create it
    try {
      await getAccount(connection, recipientAta);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          treasuryKeypair.publicKey,
          recipientAta,
          recipientPubkey,
          USDC_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Add transfer instruction
    const amountInSmallestUnit = Math.floor(amount * 1e6);
    transaction.add(
      createTransferInstruction(
        treasuryAta,
        recipientAta,
        treasuryKeypair.publicKey,
        amountInSmallestUnit,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryKeypair.publicKey;

    // Sign and send transaction
    transaction.sign(treasuryKeypair);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`[Treasury] Transaction sent: ${signature}`);

    // Confirm transaction
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`[Treasury] Transferred ${amount} USDC to ${recipientAddress}. Signature: ${signature}`);

    return { success: true, signature };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Treasury] Transfer error:', message);
    return { success: false, error: message };
  }
}

export async function canFulfillClaim(amount: number): Promise<{
  canFulfill: boolean;
  reason?: string;
  balances: TreasuryBalance;
}> {
  const balances = await getBalances();

  if (balances.solBalance < MIN_SOL_FOR_FEES) {
    return {
      canFulfill: false,
      reason: 'Treasury needs SOL for transaction fees',
      balances,
    };
  }

  if (balances.availableForClaims < amount) {
    return {
      canFulfill: false,
      reason: `Insufficient funds in treasury. Available: $${balances.availableForClaims.toFixed(2)}, needed: $${amount.toFixed(2)}`,
      balances,
    };
  }

  return { canFulfill: true, balances };
}

export async function processClaim(
  recipientAddress: string,
  amount: number
): Promise<TransferResult> {
  const { canFulfill, reason, balances } = await canFulfillClaim(amount);

  if (!canFulfill) {
    console.error('[Treasury] Claim failed - insufficient funds:', {
      amount,
      reason,
      balances,
    });
    return {
      success: false,
      error: reason || 'Insufficient funds in treasury. Please contact support.',
    };
  }

  return transferUsdc(recipientAddress, amount);
}

export function getTreasuryAddress(): string {
  return TREASURY_PUBLIC_KEY;
}
