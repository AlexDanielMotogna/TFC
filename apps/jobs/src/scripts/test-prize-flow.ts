/**
 * Test script to verify the complete prize pool flow
 * Run with: npx tsx apps/jobs/src/scripts/test-prize-flow.ts
 *
 * This script tests:
 * 1. Treasury balance check
 * 2. Withdraw from Pacifica (dry-run option)
 * 3. Prize claim flow simulation
 */
import 'dotenv/config';

// Allow URL override via command line: --url=http://localhost:3001
const urlArg = process.argv.find(arg => arg.startsWith('--url='));
const WEB_APP_URL = urlArg?.split('=')[1] || process.env.WEB_APP_URL || 'http://localhost:3001';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

interface TreasuryStatus {
  success: boolean;
  data?: {
    treasuryAddress: string;
    balances: {
      onChainUsdc: number;
      pacificaBalance: number;
      solBalance: number;
      availableForClaims: number;
    };
    thresholds: {
      minBalance: number;
      targetBalance: number;
    };
    needsWithdrawal: boolean;
  };
  error?: string;
}

async function testTreasuryStatus(): Promise<TreasuryStatus | null> {
  console.log('\n1️⃣ Testing Treasury Status API...');

  if (!INTERNAL_API_SECRET) {
    console.log('   ❌ INTERNAL_API_SECRET not configured');
    return null;
  }

  try {
    const response = await fetch(`${WEB_APP_URL}/api/internal/treasury/auto-withdraw`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
      },
    });

    const result = await response.json();

    if (result.success) {
      const b = result.data.balances;
      console.log('   ✅ Treasury status retrieved');
      console.log(`      Treasury: ${result.data.treasuryAddress}`);
      console.log(`      On-chain USDC: $${b?.onChainUsdc?.toFixed(4) || 0}`);
      console.log(`      Pacifica USDC: $${b?.pacificaBalance?.toFixed(4) || 0}`);
      console.log(`      SOL balance: ${b?.solBalance?.toFixed(6) || 0} SOL`);
      console.log(`      Available for claims: $${b?.availableForClaims?.toFixed(4) || 0}`);
      console.log(`      Needs withdrawal: ${result.data.needsWithdrawal ? 'Yes' : 'No'}`);
      return result;
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

async function testWithdrawForPrizes(amount: number, dryRun: boolean = true): Promise<boolean> {
  console.log(`\n2️⃣ Testing Withdraw for Prizes API ${dryRun ? '(DRY RUN)' : '(LIVE)'}...`);
  console.log(`   Amount: $${amount.toFixed(4)}`);

  if (!INTERNAL_API_SECRET) {
    console.log('   ❌ INTERNAL_API_SECRET not configured');
    return false;
  }

  if (dryRun) {
    console.log('   ⏭️  Skipping actual withdrawal (dry run mode)');
    console.log('   To execute real withdrawal, run with --live flag');
    return true;
  }

  try {
    const response = await fetch(`${WEB_APP_URL}/api/internal/treasury/withdraw-for-prizes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('   ✅ Withdrawal successful');
      console.log(`      Requested: $${amount.toFixed(4)}`);
      console.log(`      Withdrawn: $${result.data?.withdrawnAmount?.toFixed(4) || 'N/A'}`);
      console.log(`      Previous on-chain: $${result.data?.previousOnChain?.toFixed(4) || 'N/A'}`);
      return true;
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testClaimEndpoint(): Promise<void> {
  console.log('\n3️⃣ Testing Prize Claim Endpoint (GET)...');

  try {
    // This will fail without auth, but we can check if the endpoint exists
    const response = await fetch(`${WEB_APP_URL}/api/prize/claim`, {
      method: 'GET',
    });

    if (response.status === 401) {
      console.log('   ✅ Endpoint exists and requires authentication (expected)');
    } else {
      const result = await response.json();
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(result, null, 2)}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

async function main() {
  console.log('🧪 Prize Pool Flow Test\n');
  console.log('Configuration:');
  console.log(`  WEB_APP_URL: ${WEB_APP_URL}`);
  console.log(`  INTERNAL_API_SECRET: ${INTERNAL_API_SECRET ? '✅ Set' : '❌ Not set'}`);

  const isLive = process.argv.includes('--live');
  const testAmount = parseFloat(process.argv.find(arg => arg.startsWith('--amount='))?.split('=')[1] || '0.10');

  // Test 1: Treasury Status
  const status = await testTreasuryStatus();

  // Test 2: Withdraw for Prizes
  if (status?.data) {
    await testWithdrawForPrizes(testAmount, !isLive);
  }

  // Test 3: Claim Endpoint
  await testClaimEndpoint();

  // Summary
  console.log('\n📋 Summary:');
  console.log('─'.repeat(50));

  if (status?.data?.balances) {
    const b = status.data.balances;
    const canFulfillClaims = b.availableForClaims > 0 && b.solBalance >= 0.01;
    console.log(`Treasury ready for claims: ${canFulfillClaims ? '✅ Yes' : '❌ No'}`);

    if (!canFulfillClaims) {
      if (b.solBalance < 0.01) {
        console.log(`  → Need more SOL (have ${b.solBalance.toFixed(4)}, need 0.01)`);
      }
      if (b.availableForClaims <= 0) {
        console.log(`  → Need USDC on-chain (have $${b.onChainUsdc.toFixed(2)})`);
        if (b.pacificaBalance > 0) {
          console.log(`  → Can withdraw $${b.pacificaBalance.toFixed(2)} from Pacifica`);
        }
      }
    }
  }

  console.log('\nTo test with real withdrawal:');
  console.log(`  npx tsx apps/jobs/src/scripts/test-prize-flow.ts --live --amount=0.30`);
}

main().catch(console.error);
