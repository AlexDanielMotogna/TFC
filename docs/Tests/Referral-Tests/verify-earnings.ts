import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check earnings for CM8F wallet
  const cm8f = await prisma.user.findFirst({
    where: { walletAddress: { startsWith: 'CM8F' } },
    select: { id: true, handle: true, walletAddress: true }
  });

  const t74t7 = await prisma.user.findFirst({
    where: { walletAddress: { startsWith: '74t7' } },
    select: { id: true, handle: true, walletAddress: true }
  });

  console.log('=== CM8F User ===');
  if (cm8f) {
    const earnings = await prisma.referralEarning.aggregate({
      where: { referrerId: cm8f.id },
      _sum: { commissionAmount: true, tradeValue: true, tradeFee: true },
      _count: true
    });
    console.log('Handle:', cm8f.handle);
    console.log('Total Volume:', Number(earnings._sum.tradeValue || 0).toFixed(2));
    console.log('Total Fees:', Number(earnings._sum.tradeFee || 0).toFixed(2));
    console.log('Total Earnings:', Number(earnings._sum.commissionAmount || 0).toFixed(2));
    console.log('Count:', earnings._count);

    // Show by tier
    const byTier = await prisma.referralEarning.groupBy({
      by: ['tier'],
      where: { referrerId: cm8f.id },
      _sum: { commissionAmount: true, tradeValue: true },
      _count: true
    });
    console.log('\nBy Tier:');
    byTier.forEach(t => {
      console.log(`  T${t.tier}: $${Number(t._sum.commissionAmount || 0).toFixed(2)} from $${Number(t._sum.tradeValue || 0).toFixed(2)} volume (${t._count} trades)`);
    });
  }

  console.log('\n=== 74t7 User ===');
  if (t74t7) {
    const earnings = await prisma.referralEarning.aggregate({
      where: { referrerId: t74t7.id },
      _sum: { commissionAmount: true, tradeValue: true, tradeFee: true },
      _count: true
    });
    console.log('Handle:', t74t7.handle);
    console.log('Total Volume:', Number(earnings._sum.tradeValue || 0).toFixed(2));
    console.log('Total Fees:', Number(earnings._sum.tradeFee || 0).toFixed(2));
    console.log('Total Earnings:', Number(earnings._sum.commissionAmount || 0).toFixed(2));
    console.log('Count:', earnings._count);

    // Show by tier
    const byTier = await prisma.referralEarning.groupBy({
      by: ['tier'],
      where: { referrerId: t74t7.id },
      _sum: { commissionAmount: true, tradeValue: true },
      _count: true
    });
    console.log('\nBy Tier:');
    byTier.forEach(t => {
      console.log(`  T${t.tier}: $${Number(t._sum.commissionAmount || 0).toFixed(2)} from $${Number(t._sum.tradeValue || 0).toFixed(2)} volume (${t._count} trades)`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
