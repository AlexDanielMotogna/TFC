/**
 * Treasury Service
 * Handles prize pool withdrawals from Pacifica and USDC transfers to winners
 *
 * SETUP REQUIRED:
 * 1. Set TREASURY_PRIVATE_KEY in environment (base58 encoded private key)
 * 2. Treasury wallet: FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k
 * 3. Ensure treasury has SOL for transaction fees (~0.01 SOL per transfer)
 *
 * FLOW:
 * 1. Fees accumulate in Pacifica account (builder code fees)
 * 2. Auto-withdraw job moves USDC from Pacifica to on-chain wallet
 * 3. Users claim prizes -> USDC transferred from treasury to their wallet
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
import * as Pacifica from './pacifica';
import * as PacificaSigning from './pacifica-signing';

// Configuration
const TREASURY_PUBLIC_KEY = 'FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC on Solana mainnet
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Minimum balances
const MIN_SOL_FOR_FEES = 0.01; // SOL needed for transaction fees
const MIN_USDC_BUFFER = 0.10; // Keep at least $0.10 USDC as buffer

export interface TreasuryBalance {
  pacificaBalance: number; // Balance in Pacifica account
  onChainUsdc: number; // USDC in Solana wallet
  solBalance: number; // SOL for transaction fees
  availableForClaims: number; // Total available for prize claims
}

export interface TransferResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface WithdrawResult {
  success: boolean;
  amount?: number;
  error?: string;
}

/**
 * Get the treasury keypair from environment
 * IMPORTANT: Never expose this keypair - only use server-side
 */
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

/**
 * Get Pacifica signing keypair (same as treasury but for Pacifica API)
 */
function getPacificaKeypair() {
  const privateKey = process.env.TREASURY_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('TREASURY_PRIVATE_KEY not configured');
  }

  return PacificaSigning.keypairFromPrivateKey(privateKey);
}

/**
 * Get Solana connection
 */
function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, 'confirmed');
}

/**
 * Get all treasury balances
 */
export async function getBalances(): Promise<TreasuryBalance> {
  const connection = getConnection();
  const treasuryPubkey = new PublicKey(TREASURY_PUBLIC_KEY);

  // Get Pacifica balance
  let pacificaBalance = 0;
  try {
    const accountInfo = await Pacifica.getAccount(TREASURY_PUBLIC_KEY);
    pacificaBalance = parseFloat(accountInfo.balance) || 0;
  } catch (error) {
    console.warn('Could not fetch Pacifica balance:', error);
  }

  // Get on-chain SOL balance
  let solBalance = 0;
  try {
    const solBalanceLamports = await connection.getBalance(treasuryPubkey);
    solBalance = solBalanceLamports / 1e9; // Convert lamports to SOL
  } catch (error) {
    console.warn('Could not fetch SOL balance:', error);
  }

  // Get on-chain USDC balance
  let onChainUsdc = 0;
  try {
    const usdcAta = await getAssociatedTokenAddress(USDC_MINT, treasuryPubkey);
    const tokenAccount = await getAccount(connection, usdcAta);
    onChainUsdc = Number(tokenAccount.amount) / 1e6; // USDC has 6 decimals
  } catch (error) {
    // Token account might not exist yet
    console.warn('Could not fetch USDC balance (account may not exist):', error);
  }

  const availableForClaims = onChainUsdc - MIN_USDC_BUFFER;

  return {
    pacificaBalance,
    onChainUsdc,
    solBalance,
    availableForClaims: Math.max(0, availableForClaims),
  };
}

/**
 * Withdraw USDC from Pacifica to treasury wallet
 */
export async function withdrawFromPacifica(amount?: number): Promise<WithdrawResult> {
  try {
    const keypair = getPacificaKeypair();

    // If no amount specified, withdraw all available
    if (!amount) {
      const accountInfo = await Pacifica.getAccount(TREASURY_PUBLIC_KEY);
      const availableToWithdraw = parseFloat(accountInfo.available_to_withdraw);

      if (availableToWithdraw <= 0) {
        return { success: false, error: 'No funds available to withdraw' };
      }

      amount = availableToWithdraw;
    }

    // Execute withdrawal
    const result = await Pacifica.withdraw(keypair, amount.toString());

    if (result.success) {
      console.log(`Treasury: Withdrew ${amount} USDC from Pacifica`);
      return { success: true, amount };
    }

    return { success: false, error: 'Withdrawal failed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Treasury withdraw error:', message);
    return { success: false, error: message };
  }
}

/**
 * Transfer USDC from treasury to a recipient wallet
 */
export async function transferUsdc(
  recipientAddress: string,
  amount: number
): Promise<TransferResult> {
  try {
    // Validate amount
    if (amount <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    // Check if we have enough balance
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

    // Get or create associated token accounts
    const treasuryAta = await getAssociatedTokenAddress(USDC_MINT, treasuryKeypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

    const transaction = new Transaction();

    // Check if recipient ATA exists, if not create it
    try {
      await getAccount(connection, recipientAta);
    } catch {
      // ATA doesn't exist, add instruction to create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          treasuryKeypair.publicKey, // payer
          recipientAta, // ata
          recipientPubkey, // owner
          USDC_MINT, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // Add transfer instruction
    const amountInSmallestUnit = Math.floor(amount * 1e6); // USDC has 6 decimals
    transaction.add(
      createTransferInstruction(
        treasuryAta, // source
        recipientAta, // destination
        treasuryKeypair.publicKey, // owner
        amountInSmallestUnit, // amount
        [], // multisig
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

    console.log(`Treasury: Transaction sent: ${signature}`);

    // Confirm transaction using polling (not WebSocket to avoid serverless issues)
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`Treasury: Transferred ${amount} USDC to ${recipientAddress}. Signature: ${signature}`);

    return { success: true, signature };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Treasury transfer error:', message);
    return { success: false, error: message };
  }
}

/**
 * Check if treasury can fulfill a claim
 *
 * NOTE: Only checks on-chain balance. Pacifica funds should have been
 * withdrawn during week finalization.
 */
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

/**
 * Process a prize claim - transfer USDC from treasury to winner
 *
 * NOTE: This does NOT auto-withdraw from Pacifica.
 * Prize pool funds should be withdrawn during week finalization (one withdrawal per week)
 * to minimize Pacifica withdrawal fees ($1 per withdrawal).
 */
export async function processClaim(
  recipientAddress: string,
  amount: number
): Promise<TransferResult> {
  // Check current balances
  const { canFulfill, reason, balances } = await canFulfillClaim(amount);

  if (!canFulfill) {
    // Don't auto-withdraw from Pacifica - funds should have been withdrawn during finalization
    console.error('Prize claim failed - insufficient treasury funds:', {
      amount,
      reason,
      balances,
    });
    return {
      success: false,
      error: reason || 'Insufficient funds in treasury. Please contact support.',
    };
  }

  // Execute the transfer
  return transferUsdc(recipientAddress, amount);
}

/**
 * Get treasury public address (safe to expose)
 */
export function getTreasuryAddress(): string {
  return TREASURY_PUBLIC_KEY;
}
