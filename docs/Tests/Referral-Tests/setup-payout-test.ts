/**
 * Setup for $0.10 payout test
 * 1. Clean old pending payouts
 * 2. Create $0.10 test earning
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Step 1: Cleaning old pending payouts...\n');

  // Delete pending payouts (never processed)
  const deletedPayouts = await prisma.referralPayout.deleteMany({
    where: { status: 'pending' },
  });
  console.log(`   Deleted ${deletedPayouts.count} pending payouts`);

  // Restore earnings that were marked paid but never actually paid
  const restoredEarnings = await prisma.referralEarning.updateMany({
    where: { isPaid: true },
    data: { isPaid: false, paidAt: null },
  });
  console.log(`   Restored ${restoredEarnings.count} earnings to unpaid`);

  console.log('\n✅ Step 2: Creating $0.10 test earning...\n');

  // Find user with wallet to receive the test payout
  // Using the treasury wallet owner as test recipient
  const testUser = await prisma.user.findFirst({
    where: {
      walletAddress: 'FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k',
    },
    select: { id: true, handle: true, walletAddress: true },
  });

  if (!testUser) {
    console.log('❌ User with treasury wallet not found');
    console.log('   Looking for any user with a wallet...');

    const anyUser = await prisma.user.findFirst({
      where: { walletAddress: { not: null } },
      select: { id: true, handle: true, walletAddress: true },
    });

    if (!anyUser) {
      console.log('❌ No users with wallets found');
      return;
    }

    console.log(`   Using: ${anyUser.handle} (${anyUser.walletAddress?.slice(0, 8)}...)`);
  }

  const targetUser = testUser || await prisma.user.findFirst({
    where: { walletAddress: { not: null } },
    select: { id: true, handle: true, walletAddress: true },
  });

  if (!targetUser) {
    console.log('❌ No target user found');
    return;
  }

  // Create $0.10 test earning
  const testEarning = await prisma.referralEarning.create({
    data: {
      referrerId: targetUser.id,
      traderId: targetUser.id, // Self for test
      tradeId: `test-payout-${Date.now()}`,
      tier: 1,
      symbol: 'TEST',
      tradeFee: 0.30, // $0.30 fee
      tradeValue: 100.00,
      commissionPercent: 34.00,
      commissionAmount: 0.10, // $0.10 payout
      isPaid: false,
    },
  });

  console.log(`   Created test earning: $0.10`);
  console.log(`   Earning ID: ${testEarning.id}`);
  console.log(`   For user: ${targetUser.handle} (${targetUser.walletAddress?.slice(0, 8)}...)`);

  // Show total unclaimed for this user
  const unclaimed = await prisma.referralEarning.aggregate({
    where: { referrerId: targetUser.id, isPaid: false },
    _sum: { commissionAmount: true },
    _count: true,
  });

  console.log(`\n📊 User's total unclaimed: $${unclaimed._sum.commissionAmount?.toNumber().toFixed(4) || '0'}`);
  console.log(`   Earnings count: ${unclaimed._count}`);

  console.log('\n' + '═'.repeat(50));
  console.log('✅ SETUP COMPLETE');
  console.log('═'.repeat(50));
  console.log(`\nNow login with wallet: ${targetUser.walletAddress}`);
  console.log('Go to /referrals and click "Claim Payout"');
  console.log('\nMake sure REFERRAL_TEST_MODE=true in .env');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
