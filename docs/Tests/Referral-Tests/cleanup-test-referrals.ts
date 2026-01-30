/**
 * Cleanup script for referral system test data
 * Run with: npx tsx apps/web/src/scripts/cleanup-test-referrals.ts
 *
 * Removes all test trades and their associated referral earnings
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up referral test data...\n');

  // Find all trades created today (test trades)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const testTrades = await prisma.trade.findMany({
    where: {
      createdAt: { gte: today },
    },
    select: { id: true, symbol: true, fee: true },
  });

  if (testTrades.length === 0) {
    console.log('✅ No test trades found to clean up.');
    return;
  }

  console.log(`Found ${testTrades.length} test trades to clean up:\n`);
  testTrades.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.symbol} - fee: $${t.fee.toNumber().toFixed(2)} (${t.id.slice(0, 8)}...)`);
  });

  const tradeIds = testTrades.map((t) => t.id);

  // Delete referral earnings for these trades
  const deletedEarnings = await prisma.referralEarning.deleteMany({
    where: {
      tradeId: { in: tradeIds },
    },
  });

  console.log(`\n🗑️ Deleted ${deletedEarnings.count} referral earnings`);

  // Delete the test trades
  const deletedTrades = await prisma.trade.deleteMany({
    where: {
      id: { in: tradeIds },
    },
  });

  console.log(`🗑️ Deleted ${deletedTrades.count} test trades`);

  // Verify cleanup
  const remainingEarnings = await prisma.referralEarning.count();
  const remainingTrades = await prisma.trade.count({
    where: { createdAt: { gte: today } },
  });

  console.log('\n📊 Post-cleanup verification:');
  console.log(`   Total referral earnings remaining: ${remainingEarnings}`);
  console.log(`   Test trades remaining: ${remainingTrades}`);

  console.log('\n✅ Cleanup complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
