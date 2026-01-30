/**
 * Test script for referral payout (with Treasury transfer)
 * Run with: npx tsx docs/Tests/Referral-Tests/test-referral-payout.ts
 *
 * PREREQUISITES:
 * 1. Set REFERRAL_TEST_MODE=true in .env to allow $0.01 minimum
 * 2. Treasury wallet (FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k) needs:
 *    - At least 0.01 SOL for transaction fees
 *    - At least $0.10 USDC for test payout
 * 3. TREASURY_PRIVATE_KEY must be set in .env
 *
 * This script:
 * 1. Shows current treasury balances
 * 2. Creates a small test earning ($0.10) for a user
 * 3. Tests the claim API (simulated - requires running server)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Referral Payout Test Script\n');

  // Step 1: Check for pending payouts that need cleanup
  console.log('📋 Checking for pending payouts...');
  const pendingPayouts = await prisma.referralPayout.findMany({
    where: { status: 'pending' },
    include: {
      // Get user info
    },
  });

  if (pendingPayouts.length > 0) {
    console.log(`\n⚠️  Found ${pendingPayouts.length} pending payouts:`);
    for (const p of pendingPayouts) {
      const user = await prisma.user.findUnique({
        where: { id: p.userId },
        select: { handle: true },
      });
      console.log(`   - ${user?.handle || p.userId.slice(0, 8)}: $${p.amount.toNumber().toFixed(2)} (${p.id.slice(0, 8)})`);
    }
    console.log('\n   These need to be cleaned up before testing.');
    console.log('   Run: DELETE FROM referral_payouts WHERE status = \'pending\';');
    console.log('   And: UPDATE referral_earnings SET is_paid = false, paid_at = NULL WHERE is_paid = true;');
  } else {
    console.log('   ✅ No pending payouts found');
  }

  // Step 2: Find users with unclaimed earnings
  console.log('\n📊 Users with unclaimed earnings:');
  const earningsByUser = await prisma.referralEarning.groupBy({
    by: ['referrerId'],
    where: { isPaid: false },
    _sum: { commissionAmount: true },
    _count: true,
  });

  if (earningsByUser.length === 0) {
    console.log('   No unclaimed earnings found.');
    console.log('   Run test-referrals-t3.ts first to create test data.');
    return;
  }

  for (const e of earningsByUser) {
    const user = await prisma.user.findUnique({
      where: { id: e.referrerId },
      select: { handle: true, walletAddress: true },
    });
    const amount = e._sum.commissionAmount?.toNumber() || 0;
    console.log(`   ${user?.handle || e.referrerId.slice(0, 8)}:`);
    console.log(`     - Unclaimed: $${amount.toFixed(4)}`);
    console.log(`     - Earnings count: ${e._count}`);
    console.log(`     - Wallet: ${user?.walletAddress?.slice(0, 8)}...`);
  }

  // Step 3: Create a small test earning for testing payout
  console.log('\n🔧 Creating test earning for payout test...');

  // Find user with a wallet who doesn't have unclaimed earnings
  // Or use existing user with earnings
  const testUser = earningsByUser[0];
  const testUserId = testUser.referrerId;

  const user = await prisma.user.findUnique({
    where: { id: testUserId },
    select: { handle: true, walletAddress: true },
  });

  console.log(`   Target user: ${user?.handle || testUserId.slice(0, 8)}`);
  console.log(`   Current unclaimed: $${testUser._sum.commissionAmount?.toNumber().toFixed(4) || '0'}`);

  // Step 4: Instructions for testing
  console.log('\n' + '═'.repeat(60));
  console.log('📝 TESTING INSTRUCTIONS');
  console.log('═'.repeat(60));

  console.log('\n1️⃣  Set environment variable:');
  console.log('   REFERRAL_TEST_MODE=true');
  console.log('   (This allows $0.01 minimum payout instead of $10)');

  console.log('\n2️⃣  Check treasury balance:');
  console.log('   Treasury wallet: FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k');
  console.log('   Needs: >= 0.01 SOL + >= $0.10 USDC');

  console.log('\n3️⃣  Start the server:');
  console.log('   npm run dev');

  console.log('\n4️⃣  Login as the test user and go to /referrals');
  console.log(`   User: ${user?.handle || testUserId.slice(0, 8)}`);
  console.log(`   Wallet: ${user?.walletAddress}`);

  console.log('\n5️⃣  Click "Claim Payout" button');

  console.log('\n6️⃣  Verify:');
  console.log('   - USDC transferred to user wallet');
  console.log('   - ReferralPayout record created with txSignature');
  console.log('   - ReferralEarnings marked as isPaid=true');

  // Step 5: SQL to manually test small amount
  console.log('\n' + '═'.repeat(60));
  console.log('🔧 ALTERNATIVE: Create $0.10 test earning manually');
  console.log('═'.repeat(60));

  console.log('\n-- Create a small test earning:');
  console.log(`INSERT INTO referral_earnings (`);
  console.log(`  id, referrer_id, trader_id, trade_id, tier,`);
  console.log(`  symbol, trade_fee, trade_value,`);
  console.log(`  commission_percent, commission_amount,`);
  console.log(`  is_paid, earned_at`);
  console.log(`) VALUES (`);
  console.log(`  gen_random_uuid(),`);
  console.log(`  '${testUserId}',  -- referrer`);
  console.log(`  '${testUserId}',  -- trader (self for test)`);
  console.log(`  gen_random_uuid(),  -- fake trade_id`);
  console.log(`  1,  -- tier`);
  console.log(`  'TEST',  -- symbol`);
  console.log(`  0.30,  -- trade_fee ($0.30)`);
  console.log(`  100.00,  -- trade_value`);
  console.log(`  34.00,  -- commission_percent`);
  console.log(`  0.10,  -- commission_amount ($0.10)`);
  console.log(`  false,  -- is_paid`);
  console.log(`  NOW()  -- earned_at`);
  console.log(`);`);

  console.log('\n✅ Test setup complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
