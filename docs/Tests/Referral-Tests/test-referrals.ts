/**
 * Test script for referral system
 * Run with: npx tsx apps/web/src/scripts/test-referrals.ts
 *
 * Creates fake trades and calculates referral commissions to test the system
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
  console.log('🧪 Starting referral system test...\n');

  // Step 1: Show current referral structure
  console.log('📊 Current Referral Structure:');
  const referrals = await prisma.referral.findMany({
    include: {
      referrer: { select: { id: true, handle: true, referralCode: true } },
      referred: { select: { id: true, handle: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (referrals.length === 0) {
    console.log('❌ No referrals found. Cannot test without referral chain.');
    return;
  }

  console.log('');
  referrals.forEach((r) => {
    console.log(
      `  T${r.tier}: ${r.referrer.handle || r.referrer.id.slice(0, 8)} → ${r.referred.handle || r.referred.id.slice(0, 8)}`
    );
  });
  console.log('');

  // Find a user who has referrers (to simulate them making trades)
  const userWithReferrers = await prisma.user.findFirst({
    where: {
      referredById: { not: null },
    },
    select: {
      id: true,
      handle: true,
      referredById: true,
    },
  });

  if (!userWithReferrers) {
    console.log('❌ No users with referrers found.');
    return;
  }

  console.log(
    `🎯 Target user for fake trades: ${userWithReferrers.handle || userWithReferrers.id.slice(0, 8)}`
  );

  // Get all referrers for this user
  const userReferrals = await prisma.referral.findMany({
    where: { referredId: userWithReferrers.id },
    include: {
      referrer: { select: { id: true, handle: true } },
    },
    orderBy: { tier: 'asc' },
  });

  console.log('\n📋 Referrers who will earn commissions:');
  userReferrals.forEach((r) => {
    const rate = COMMISSION_RATES[r.tier as 1 | 2 | 3];
    console.log(
      `  T${r.tier}: ${r.referrer.handle || r.referrer.id.slice(0, 8)} (${(rate * 100).toFixed(0)}% commission)`
    );
  });

  // Step 2: Create fake trades
  console.log('\n💹 Creating fake trades...');

  // Generate unique IDs for test data (use timestamp-based IDs)
  const testPrefix = `TEST_${Date.now()}_`;
  const testTrades = [
    { symbol: 'BTC', side: 'BUY', amount: '0.01', price: '96500', fee: '5.00', pnl: null },
    { symbol: 'ETH', side: 'SELL', amount: '1.5', price: '3400', fee: '10.00', pnl: '25.50' },
    { symbol: 'SOL', side: 'BUY', amount: '100', price: '95', fee: '2.50', pnl: null },
    { symbol: 'BTC', side: 'SELL', amount: '0.005', price: '97000', fee: '3.00', pnl: '-15.00' },
    { symbol: 'ETH', side: 'BUY', amount: '0.8', price: '3450', fee: '7.50', pnl: null },
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
    const pacificaHistoryId = BigInt(Math.floor(Date.now() * 1000 + i + Math.random() * 1000));

    const createdTrade = await prisma.trade.create({
      data: {
        userId: userWithReferrers.id,
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

  // Step 3: Calculate commissions for each trade
  console.log('\n💰 Calculating referral commissions...');

  let totalEarningsCreated = 0;

  for (const trade of createdTrades) {
    const feeNum = parseFloat(trade.fee);
    const tradeValue =
      parseFloat(trade.amount) * parseFloat(trade.price);

    console.log(`\n  📝 Processing trade ${trade.id.slice(0, 8)}... (${trade.symbol}, fee: $${feeNum.toFixed(2)})`);

    for (const referral of userReferrals) {
      const commissionRate = COMMISSION_RATES[referral.tier as 1 | 2 | 3];
      const commissionAmount = feeNum * commissionRate;

      await prisma.referralEarning.create({
        data: {
          referrerId: referral.referrerId,
          traderId: userWithReferrers.id,
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
        `     T${referral.tier}: ${referral.referrer.handle || referral.referrer.id.slice(0, 8)} earns $${commissionAmount.toFixed(4)} (${(commissionRate * 100).toFixed(0)}% of $${feeNum.toFixed(2)})`
      );
      totalEarningsCreated++;
    }
  }

  console.log(`\n✅ Created ${totalEarningsCreated} referral earnings records`);

  // Step 4: Show summary for each referrer
  console.log('\n📊 Summary by Referrer:');

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

    console.log(`\n  ${referral.referrer.handle || referral.referrer.id.slice(0, 8)} (T${referral.tier} referrer):`);
    console.log(`    - Total unclaimed: $${earnings._sum.commissionAmount?.toNumber().toFixed(4) || '0.0000'}`);
    console.log(`    - Referral volume: $${earnings._sum.tradeValue?.toNumber().toFixed(2) || '0.00'}`);
    console.log(`    - Earnings count: ${earnings._count}`);
  }

  // Step 5: Total fees and commissions
  const totalFees = testTrades.reduce((sum, t) => sum + parseFloat(t.fee), 0);
  const t1Commissions = totalFees * COMMISSION_RATES[1];
  const t2Commissions = totalFees * COMMISSION_RATES[2];
  const t3Commissions = totalFees * COMMISSION_RATES[3];

  console.log('\n📈 Test Summary:');
  console.log(`  - Total fees generated: $${totalFees.toFixed(2)}`);
  console.log(`  - T1 commissions (34%): $${t1Commissions.toFixed(4)}`);
  console.log(`  - T2 commissions (12%): $${t2Commissions.toFixed(4)}`);
  console.log(`  - T3 commissions (4%):  $${t3Commissions.toFixed(4)}`);

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

  console.log('\n✅ Test completed! Now check /referrals page for each referrer.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
