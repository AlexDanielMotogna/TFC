/**
 * Verify referral dashboard data
 * Run with: npx tsx apps/web/src/scripts/verify-referral-dashboard.ts
 *
 * Queries the same data as the dashboard API and verifies correctness
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Verifying Referral Dashboard Data...\n');

  // Get all users who have referral earnings
  const referrersWithEarnings = await prisma.referralEarning.groupBy({
    by: ['referrerId'],
    _sum: {
      commissionAmount: true,
    },
    _count: true,
  });

  if (referrersWithEarnings.length === 0) {
    console.log('❌ No referral earnings found.');
    return;
  }

  console.log(`Found ${referrersWithEarnings.length} referrers with earnings\n`);

  for (const referrer of referrersWithEarnings) {
    const user = await prisma.user.findUnique({
      where: { id: referrer.referrerId },
      select: { id: true, handle: true, referralCode: true, walletAddress: true },
    });

    console.log('═'.repeat(60));
    console.log(`👤 Referrer: ${user?.handle || user?.id.slice(0, 8)}`);
    console.log(`   Wallet: ${user?.walletAddress?.slice(0, 8)}...`);
    console.log(`   Referral Code: ${user?.referralCode}`);
    console.log('═'.repeat(60));

    // Query same data as /api/referrals/dashboard
    const userId = referrer.referrerId;

    // 1. Total Referrals by tier
    const [t1Count, t2Count, t3Count] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId, tier: 1 } }),
      prisma.referral.count({ where: { referrerId: userId, tier: 2 } }),
      prisma.referral.count({ where: { referrerId: userId, tier: 3 } }),
    ]);

    console.log('\n📈 Total Referrals:');
    console.log(`   T1: ${t1Count}`);
    console.log(`   T2: ${t2Count}`);
    console.log(`   T3: ${t3Count}`);
    console.log(`   Total: ${t1Count + t2Count + t3Count}`);

    // 2. Total Earnings by tier (using raw SQL for proper aggregation)
    const earningsByTier = await prisma.$queryRaw<
      Array<{ tier: number; total: string; volume: string; count: string }>
    >(
      Prisma.sql`
        SELECT
          tier,
          COALESCE(SUM(commission_amount), 0)::text as total,
          COALESCE(SUM(trade_value), 0)::text as volume,
          COUNT(*)::text as count
        FROM referral_earnings
        WHERE referrer_id::text = ${userId}
        GROUP BY tier
        ORDER BY tier
      `
    );

    console.log('\n💰 Earnings by Tier:');
    let totalEarnings = 0;
    let totalVolume = 0;
    for (const e of earningsByTier) {
      const earnings = parseFloat(e.total);
      const volume = parseFloat(e.volume);
      totalEarnings += earnings;
      totalVolume += volume;
      console.log(`   T${e.tier}: $${earnings.toFixed(4)} from $${volume.toFixed(2)} volume (${e.count} trades)`);
    }
    console.log(`   Total: $${totalEarnings.toFixed(4)}`);

    // 3. Unclaimed Payout
    const unclaimedResult = await prisma.$queryRaw<[{ total: string }]>(
      Prisma.sql`
        SELECT COALESCE(SUM(commission_amount), 0)::text as total
        FROM referral_earnings
        WHERE referrer_id::text = ${userId} AND is_paid = false
      `
    );
    const unclaimed = parseFloat(unclaimedResult[0].total);
    console.log(`\n💵 Unclaimed Payout: $${unclaimed.toFixed(4)}`);
    console.log(`   Can claim? ${unclaimed >= 10 ? '✅ Yes (>= $10)' : '❌ No (< $10)'}`);

    // 4. Referral Volume by tier
    console.log('\n📊 Referral Volume by Tier:');
    for (const e of earningsByTier) {
      console.log(`   T${e.tier}: $${parseFloat(e.volume).toFixed(2)}`);
    }
    console.log(`   Total: $${totalVolume.toFixed(2)}`);

    // 5. Recent Referrals
    const recentReferrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: { select: { handle: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log('\n👥 Recent Referrals:');
    if (recentReferrals.length === 0) {
      console.log('   (none)');
    } else {
      recentReferrals.forEach((r) => {
        console.log(
          `   T${r.tier}: ${r.referred.handle || r.referredId.slice(0, 8)} (${r.createdAt.toISOString().split('T')[0]})`
        );
      });
    }

    // 6. Recent Earnings
    const recentEarnings = await prisma.referralEarning.findMany({
      where: { referrerId: userId },
      orderBy: { earnedAt: 'desc' },
      take: 5,
    });

    console.log('\n💸 Recent Earnings:');
    if (recentEarnings.length === 0) {
      console.log('   (none)');
    } else {
      recentEarnings.forEach((e) => {
        const status = e.isPaid ? '✓ Paid' : '○ Unpaid';
        console.log(
          `   T${e.tier}: $${e.commissionAmount.toNumber().toFixed(4)} from ${e.symbol} trade (${status})`
        );
      });
    }

    // 7. Payout History
    const payouts = await prisma.referralPayout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    console.log('\n📤 Payout History:');
    if (payouts.length === 0) {
      console.log('   (no payouts yet)');
    } else {
      payouts.forEach((p) => {
        console.log(`   $${p.amount.toNumber().toFixed(2)} - ${p.status} (${p.createdAt.toISOString().split('T')[0]})`);
      });
    }

    console.log('\n');
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('═'.repeat(60));

  const totalStats = await prisma.referralEarning.aggregate({
    _sum: {
      commissionAmount: true,
      tradeFee: true,
      tradeValue: true,
    },
    _count: true,
  });

  console.log(`\nTotal referral earnings in database:`);
  console.log(`  - Total commissions: $${totalStats._sum.commissionAmount?.toNumber().toFixed(4) || '0.0000'}`);
  console.log(`  - Total trade fees: $${totalStats._sum.tradeFee?.toNumber().toFixed(4) || '0.0000'}`);
  console.log(`  - Total trade volume: $${totalStats._sum.tradeValue?.toNumber().toFixed(2) || '0.00'}`);
  console.log(`  - Total earnings records: ${totalStats._count}`);

  // Verify commission rates
  console.log('\n✅ Commission rate verification:');
  const samples = await prisma.referralEarning.findMany({
    take: 3,
  });

  samples.forEach((s, i) => {
    const expectedRate = { 1: 34, 2: 12, 3: 4 }[s.tier] || 0;
    const actualRate = s.commissionPercent.toNumber();
    const status = actualRate === expectedRate ? '✓' : '✗';
    console.log(
      `  ${status} Sample ${i + 1}: T${s.tier} has ${actualRate}% (expected ${expectedRate}%)`
    );
  });

  console.log('\n✅ Verification complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
