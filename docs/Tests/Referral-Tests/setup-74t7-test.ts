import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Delete old TEST earning
  const del = await prisma.referralEarning.deleteMany({ where: { symbol: 'TEST' } });
  console.log('Deleted:', del.count);

  // Find user with wallet 74t75hMr...
  const user = await prisma.user.findFirst({
    where: { walletAddress: '74t75hMr5AtH766f56QNWxyLviFHEZBgpuWU2K5ARveo' },
    select: { id: true, handle: true, walletAddress: true }
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('User:', user.handle);
  console.log('Wallet:', user.walletAddress);

  // Create earning
  await prisma.referralEarning.create({
    data: {
      referrerId: user.id,
      traderId: user.id,
      tradeId: `test-payout-${Date.now()}`,
      tier: 1,
      symbol: 'TEST',
      tradeFee: 0.30,
      tradeValue: 100,
      commissionPercent: 34,
      commissionAmount: 0.10,
      isPaid: false
    }
  });

  console.log('\n✅ Created $0.10 earning');
  console.log('Treasury (FQUc4RGM...) → $0.10 USDC → 74t75hMr...');
}

main().finally(() => prisma.$disconnect());
