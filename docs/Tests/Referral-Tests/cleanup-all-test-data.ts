/**
 * Comprehensive cleanup script for ALL referral test data
 * Run with: npx tsx docs/Tests/Referral-Tests/cleanup-all-test-data.ts
 *
 * This script removes:
 * - All test users (handle starts with 'TEST_')
 * - All referrals to test users
 * - All referral earnings from test trades
 * - All test trades (created today)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Comprehensive cleanup of ALL referral test data...\n');

  // Step 1: Find test users
  const testUsers = await prisma.user.findMany({
    where: {
      handle: { startsWith: 'TEST_' },
    },
    select: { id: true, handle: true },
  });

  console.log(`Found ${testUsers.length} test users`);
  testUsers.forEach((u) => console.log(`  - ${u.handle}`));

  // Step 2: Find trades created today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const testTrades = await prisma.trade.findMany({
    where: {
      createdAt: { gte: today },
    },
    select: { id: true, symbol: true },
  });

  console.log(`\nFound ${testTrades.length} trades created today`);

  // Step 3: Delete referral earnings for test trades
  if (testTrades.length > 0) {
    const tradeIds = testTrades.map((t) => t.id);
    const deletedEarnings = await prisma.referralEarning.deleteMany({
      where: {
        tradeId: { in: tradeIds },
      },
    });
    console.log(`\n🗑️ Deleted ${deletedEarnings.count} referral earnings`);
  }

  // Step 4: Delete test trades
  if (testTrades.length > 0) {
    const deletedTrades = await prisma.trade.deleteMany({
      where: {
        createdAt: { gte: today },
      },
    });
    console.log(`🗑️ Deleted ${deletedTrades.count} test trades`);
  }

  // Step 5: Delete referrals involving test users
  if (testUsers.length > 0) {
    const testUserIds = testUsers.map((u) => u.id);

    const deletedReferrals = await prisma.referral.deleteMany({
      where: {
        OR: [
          { referredId: { in: testUserIds } },
          { referrerId: { in: testUserIds } },
        ],
      },
    });
    console.log(`🗑️ Deleted ${deletedReferrals.count} test referrals`);
  }

  // Step 6: Delete test users
  if (testUsers.length > 0) {
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        handle: { startsWith: 'TEST_' },
      },
    });
    console.log(`🗑️ Deleted ${deletedUsers.count} test users`);
  }

  // Step 7: Verify cleanup
  console.log('\n📊 Post-cleanup verification:');

  const remainingTestUsers = await prisma.user.count({
    where: { handle: { startsWith: 'TEST_' } },
  });
  console.log(`   Test users remaining: ${remainingTestUsers}`);

  const remainingTestTrades = await prisma.trade.count({
    where: { createdAt: { gte: today } },
  });
  console.log(`   Trades from today remaining: ${remainingTestTrades}`);

  const totalEarnings = await prisma.referralEarning.count();
  console.log(`   Total referral earnings in DB: ${totalEarnings}`);

  console.log('\n✅ Comprehensive cleanup complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
