import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning all fake test data...\n');

  // 1. Delete ALL referral earnings
  const del1 = await prisma.referralEarning.deleteMany({});
  console.log(`Deleted ${del1.count} referral earnings`);

  // 2. Delete test trades (created today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const del2 = await prisma.trade.deleteMany({
    where: { createdAt: { gte: today } }
  });
  console.log(`Deleted ${del2.count} test trades`);

  // 3. Delete test referrals for TEST_ users
  const testUsers = await prisma.user.findMany({
    where: { handle: { startsWith: 'TEST_' } },
    select: { id: true }
  });

  if (testUsers.length > 0) {
    const del3 = await prisma.referral.deleteMany({
      where: { referredId: { in: testUsers.map(u => u.id) } }
    });
    console.log(`Deleted ${del3.count} test referrals`);

    // 4. Delete test users
    const del4 = await prisma.user.deleteMany({
      where: { handle: { startsWith: 'TEST_' } }
    });
    console.log(`Deleted ${del4.count} test users`);
  }

  // 5. Create ONLY $0.10 test earning for 74t7
  console.log('\n✅ Creating $0.10 test earning...');

  const user = await prisma.user.findFirst({
    where: { walletAddress: '74t75hMr5AtH766f56QNWxyLviFHEZBgpuWU2K5ARveo' },
    select: { id: true, handle: true }
  });

  if (!user) {
    console.log('❌ User 74t7 not found');
    return;
  }

  await prisma.referralEarning.create({
    data: {
      referrerId: user.id,
      traderId: user.id,
      tradeId: `real-test-${Date.now()}`,
      tier: 1,
      symbol: 'TEST',
      tradeFee: 0.30,
      tradeValue: 100,
      commissionPercent: 34,
      commissionAmount: 0.10,
      isPaid: false
    }
  });

  console.log(`Created $0.10 earning for ${user.handle}`);

  // Verify
  const total = await prisma.referralEarning.aggregate({
    where: { referrerId: user.id, isPaid: false },
    _sum: { commissionAmount: true },
    _count: true
  });

  console.log(`\n📊 Final state for ${user.handle}:`);
  console.log(`   Unclaimed: $${total._sum.commissionAmount?.toNumber().toFixed(2)}`);
  console.log(`   Count: ${total._count}`);
  console.log('\n🎯 Ready to test! Refresh /referrals page');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
