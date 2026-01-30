/**
 * Test script for T2 referral commissions
 * Run with: npx tsx apps/web/src/scripts/test-referrals-t2.ts
 *
 * Creates fake trades for the T2 referred user (CM8F...ovWP) to test:
 * - T1 earns 34% (DxiS...ue5M)
 * - T2 earns 12% (74t7...Rveo)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Commission rates (must match .env)
const COMMISSION_RATES = {
  1: 0.34, // T1: 34%
  2: 0.12, // T2: 12%
  3: 0.04, // T3: 4%
};

async function main() {
  console.log('🧪 Starting T2 referral test...\n');

  // Find user who has BOTH T1 and T2 referrers
  const referrals = await prisma.referral.findMany({
    include: {
      referrer: { select: { id: true, handle: true } },
      referred: { select: { id: true, handle: true } },
    },
  });

  // Group by referredId to find user with multiple tiers
  const referralsByReferred: Record<
    string,
    Array<{ tier: number; referrerId: string; referrerHandle: string | null }>
  > = {};

  for (const r of referrals) {
    if (!referralsByReferred[r.referredId]) {
      referralsByReferred[r.referredId] = [];
    }
    referralsByReferred[r.referredId].push({
      tier: r.tier,
      referrerId: r.referrerId,
      referrerHandle: r.referrer.handle,
    });
  }

  // Find user with most referrers (ideally T1 and T2)
  let targetUserId: string | null = null;
  let maxTiers = 0;

  for (const [userId, refs] of Object.entries(referralsByReferred)) {
    if (refs.length > maxTiers) {
      maxTiers = refs.length;
      targetUserId = userId;
    }
  }

  if (!targetUserId || maxTiers < 2) {
    console.log('❌ No user found with T1 and T2 referrers. Current structure:');
    console.log(JSON.stringify(referralsByReferred, null, 2));
    return;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, handle: true },
  });

  console.log(
    `🎯 Target user: ${targetUser?.handle || targetUserId.slice(0, 8)} (has ${maxTiers} tier referrers)`
  );

  const userReferrals = referralsByReferred[targetUserId].sort((a, b) => a.tier - b.tier);
  console.log('\n📋 Referrers who will earn commissions:');
  userReferrals.forEach((r) => {
    const rate = COMMISSION_RATES[r.tier as 1 | 2 | 3];
    console.log(
      `  T${r.tier}: ${r.referrerHandle || r.referrerId.slice(0, 8)} (${(rate * 100).toFixed(0)}% commission)`
    );
  });

  // Create fake trades for this user
  console.log('\n💹 Creating fake trades for T2 test...');

  const testTrades = [
    { symbol: 'BTC', side: 'BUY', amount: '0.02', price: '96800', fee: '15.00', pnl: null },
    { symbol: 'ETH', side: 'SELL', amount: '2.0', price: '3500', fee: '20.00', pnl: '50.00' },
    { symbol: 'SOL', side: 'BUY', amount: '200', price: '100', fee: '8.00', pnl: null },
  ];

  const createdTrades: Array<{
    id: string;
    symbol: string;
    fee: string;
    amount: string;
    price: string;
  }> = [];

  for (let i = 0; i < testTrades.length; i++) {
    const trade = testTrades[i];
    const pacificaHistoryId = BigInt(Math.floor(Date.now() * 1000 + i + 10000 + Math.random() * 1000));

    const createdTrade = await prisma.trade.create({
      data: {
        userId: targetUserId,
        pacificaHistoryId,
        symbol: trade.symbol,
        side: trade.side,
        amount: trade.amount,
        price: trade.price,
        fee: trade.fee,
        pnl: trade.pnl,
        executedAt: new Date(),
      },
    });

    createdTrades.push({
      id: createdTrade.id,
      symbol: trade.symbol,
      fee: trade.fee,
      amount: trade.amount,
      price: trade.price,
    });

    console.log(
      `  ✅ Trade ${i + 1}: ${trade.symbol} ${trade.side} ${trade.amount} @ $${trade.price} (fee: $${trade.fee})`
    );
  }

  // Calculate commissions for each trade
  console.log('\n💰 Calculating referral commissions...');

  let totalEarningsCreated = 0;

  for (const trade of createdTrades) {
    const feeNum = parseFloat(trade.fee);
    const tradeValue = parseFloat(trade.amount) * parseFloat(trade.price);

    console.log(`\n  📝 Processing trade ${trade.id.slice(0, 8)}... (${trade.symbol}, fee: $${feeNum.toFixed(2)})`);

    for (const referral of userReferrals) {
      const commissionRate = COMMISSION_RATES[referral.tier as 1 | 2 | 3];
      const commissionAmount = feeNum * commissionRate;

      await prisma.referralEarning.create({
        data: {
          referrerId: referral.referrerId,
          traderId: targetUserId,
          tradeId: trade.id,
          tier: referral.tier,
          symbol: trade.symbol,
          tradeFee: feeNum,
          tradeValue,
          commissionPercent: commissionRate * 100,
          commissionAmount,
          isPaid: false,
        },
      });

      console.log(
        `     T${referral.tier}: ${referral.referrerHandle || referral.referrerId.slice(0, 8)} earns $${commissionAmount.toFixed(4)} (${(commissionRate * 100).toFixed(0)}% of $${feeNum.toFixed(2)})`
      );
      totalEarningsCreated++;
    }
  }

  console.log(`\n✅ Created ${totalEarningsCreated} referral earnings records`);

  // Show summary for each referrer
  console.log('\n📊 Summary by Referrer (including previous test):');

  for (const referral of userReferrals) {
    const earnings = await prisma.referralEarning.aggregate({
      where: {
        referrerId: referral.referrerId,
        isPaid: false,
      },
      _sum: {
        commissionAmount: true,
        tradeValue: true,
      },
      _count: true,
    });

    console.log(`\n  ${referral.referrerHandle || referral.referrerId.slice(0, 8)} (T${referral.tier} referrer):`);
    console.log(`    - Total unclaimed: $${earnings._sum.commissionAmount?.toNumber().toFixed(4) || '0.0000'}`);
    console.log(`    - Referral volume: $${earnings._sum.tradeValue?.toNumber().toFixed(2) || '0.00'}`);
    console.log(`    - Earnings count: ${earnings._count}`);
  }

  // Total fees and commissions
  const totalFees = testTrades.reduce((sum, t) => sum + parseFloat(t.fee), 0);

  console.log('\n📈 T2 Test Summary:');
  console.log(`  - Total fees generated: $${totalFees.toFixed(2)}`);
  console.log(`  - T1 commissions (34%): $${(totalFees * COMMISSION_RATES[1]).toFixed(4)}`);
  console.log(`  - T2 commissions (12%): $${(totalFees * COMMISSION_RATES[2]).toFixed(4)}`);

  // Store trade IDs for cleanup
  console.log('\n🗑️ To clean up test data, run:');
  console.log('');
  console.log('-- Delete test referral earnings');
  createdTrades.forEach((t) => {
    console.log(`DELETE FROM referral_earnings WHERE trade_id = '${t.id}';`);
  });
  console.log('');
  console.log('-- Delete test trades');
  createdTrades.forEach((t) => {
    console.log(`DELETE FROM trades WHERE id = '${t.id}';`);
  });

  console.log('\n✅ T2 Test completed! Now check /referrals page for each referrer.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
