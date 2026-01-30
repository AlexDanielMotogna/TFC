/**
 * Check Treasury balance for referral payouts
 * Run with: npx tsx docs/Tests/Referral-Tests/check-treasury-balance.ts
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const TREASURY_PUBLIC_KEY = 'FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function main() {
  console.log('💰 Treasury Balance Check\n');
  console.log(`Treasury Wallet: ${TREASURY_PUBLIC_KEY}\n`);

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const treasuryPubkey = new PublicKey(TREASURY_PUBLIC_KEY);

  // Get SOL balance
  let solBalance = 0;
  try {
    const solBalanceLamports = await connection.getBalance(treasuryPubkey);
    solBalance = solBalanceLamports / 1e9;
    console.log(`SOL Balance: ${solBalance.toFixed(6)} SOL`);
    console.log(`  ${solBalance >= 0.01 ? '✅' : '❌'} Need >= 0.01 SOL for gas fees`);
  } catch (error) {
    console.log('❌ Could not fetch SOL balance:', error);
  }

  // Get USDC balance
  let usdcBalance = 0;
  try {
    const usdcAta = await getAssociatedTokenAddress(USDC_MINT, treasuryPubkey);
    console.log(`\nUSDC Token Account: ${usdcAta.toBase58()}`);

    const tokenAccount = await getAccount(connection, usdcAta);
    usdcBalance = Number(tokenAccount.amount) / 1e6; // USDC has 6 decimals
    console.log(`USDC Balance: $${usdcBalance.toFixed(6)} USDC`);
    console.log(`  ${usdcBalance >= 0.10 ? '✅' : '❌'} Need >= $0.10 USDC for test payout`);
  } catch (error: any) {
    if (error.name === 'TokenAccountNotFoundError') {
      console.log('\n❌ USDC Token Account does not exist');
      console.log('   Treasury needs USDC deposited first');
    } else {
      console.log('❌ Could not fetch USDC balance:', error.message);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('SUMMARY');
  console.log('═'.repeat(50));

  const canPayOut = solBalance >= 0.01 && usdcBalance >= 0.10;

  if (canPayOut) {
    console.log('\n✅ Treasury can process $0.10 test payout');
    console.log(`   Available for payouts: $${(usdcBalance - 0.10).toFixed(2)} USDC (keeping $0.10 buffer)`);
  } else {
    console.log('\n❌ Treasury cannot process payout:');
    if (solBalance < 0.01) {
      console.log(`   - Need ${(0.01 - solBalance).toFixed(4)} more SOL`);
    }
    if (usdcBalance < 0.10) {
      console.log(`   - Need $${(0.10 - usdcBalance).toFixed(2)} more USDC`);
    }
  }

  console.log('\n📍 Solscan link:');
  console.log(`   https://solscan.io/account/${TREASURY_PUBLIC_KEY}`);
}

main().catch(console.error);
