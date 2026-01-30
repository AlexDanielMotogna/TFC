/**
 * Test script for T3 referral commissions (full 3-tier chain)
 * Run with: npx tsx apps/web/src/scripts/test-referrals-t3.ts
 *
 * Creates a new test user at the end of the chain to test:
 * - T1 earns 34% (CM8F...ovWP - direct referrer)
 * - T2 earns 12% (DxiS...ue5M - referrer's referrer)
 * - T3 earns 4%  (74t7...Rveo - referrer's referrer's referrer)
 *
 * Chain: 74t7 → DxiS → CM8F → [NEW_TEST_USER]
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Commission rates (must match .env)
const COMMISSION_RATES = {
  1: 0.34, // T1: 34%
  2: 0.12, // T2: 12%
  3: 0.04, // T3: 4%
};

async function main() {
  console.log('🧪 Starting T3 referral test (full 3-tier chain)...\n');

  // Step 1: Find the user at the end of the current chain (CM8F...ovWP)
  // This user should have both T1 and T2 referrers
  const referrals = await prisma.referral.findMany({
    include: {
      referrer: { select: { id: true, handle: true, referralCode: true } },
      referred: { select: { id: true, handle: true, referralCode: true } },
    },
  });

  // Find user who has T2 referrer (meaning they're at depth 2 in the chain)
  const usersWithT2 = referrals
    .filter((r) => r.tier === 2)
    .map((r) => r.referredId);

  if (usersWithT2.length === 0) {
    console.log('❌ No user found with T2 referrer. Need at least 3 users in chain.');
    return;
  }

  // Get the user who will be the T1 referrer for our new test user
  const t1Referrer = await prisma.user.findUnique({
    where: { id: usersWithT2[0] },
    select: { id: true, handle: true, referralCode: true },
  });

  if (!t1Referrer || !t1Referrer.referralCode) {
    console.log('❌ T1 referrer not found or has no referral code.');
    return;
  }

  console.log(`📋 Current chain structure:`);

  // Show the full chain
  const t1Ref = referrals.find((r) => r.referredId === t1Referrer.id && r.tier === 1);
  const t2Ref = referrals.find((r) => r.referredId === t1Referrer.id && r.tier === 2);

  if (t1Ref && t2Ref) {
    console.log(`   ${t2Ref.referrer.handle || t2Ref.referrer.id.slice(0, 8)} (will be T3)`);
    console.log(`     ↓`);
    console.log(`   ${t1Ref.referrer.handle || t1Ref.referrer.id.slice(0, 8)} (will be T2)`);
    console.log(`     ↓`);
    console.log(`   ${t1Referrer.handle || t1Referrer.id.slice(0, 8)} (will be T1)`);
    console.log(`     ↓`);
    console.log(`   [NEW_TEST_USER] (trader)`);
  }

  // Step 2: Create a new test user
  console.log('\n👤 Creating test user...');

  const testUserId = crypto.randomUUID();
  const testHandle = `TEST_T3_${Date.now().toString(36)}`;
  const testWallet = `TEST${crypto.randomBytes(16).toString('hex').slice(0, 40)}`;
  const testReferralCode = crypto.randomBytes(8).toString('hex');

  const testUser = await prisma.user.create({
    data: {
      id: testUserId,
      handle: testHandle,
      walletAddress: testWallet,
      referralCode: testReferralCode,
      referredById: t1Referrer.id,
    },
  });

  console.log(`   Created: ${testUser.handle} (${testUser.id.slice(0, 8)}...)`);

  // Step 3: Create the 3-tier referral chain
  console.log('\n🔗 Creating 3-tier referral chain...');

  // T1: Direct referrer
  await prisma.referral.create({
    data: {
      referrerId: t1Referrer.id,
      referredId: testUser.id,
      tier: 1,
    },
  });
  console.log(`   ✅ T1: ${t1Referrer.handle || t1Referrer.id.slice(0, 8)} → ${testUser.handle}`);

  // T2: Referrer's referrer
  if (t1Ref) {
    await prisma.referral.create({
      data: {
        referrerId: t1Ref.referrerId,
        referredId: testUser.id,
        tier: 2,
      },
    });
    console.log(`   ✅ T2: ${t1Ref.referrer.handle || t1Ref.referrer.id.slice(0, 8)} → ${testUser.handle}`);
  }

  // T3: Referrer's referrer's referrer
  if (t2Ref) {
    await prisma.referral.create({
      data: {
        referrerId: t2Ref.referrerId,
        referredId: testUser.id,
        tier: 3,
      },
    });
    console.log(`   ✅ T3: ${t2Ref.referrer.handle || t2Ref.referrer.id.slice(0, 8)} → ${testUser.handle}`);
  }

  // Step 4: Create fake trades for the test user
  console.log('\n💹 Creating fake trades...');

  const testTrades = [
    { symbol: 'BTC', side: 'BUY', amount: '0.05', price: '97000', fee: '25.00', pnl: null },
    { symbol: 'ETH', side: 'SELL', amount: '5.0', price: '3600', fee: '50.00', pnl: '120.00' },
    { symbol: 'SOL', side: 'BUY', amount: '500', price: '105', fee: '15.00', pnl: null },
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
    const pacificaHistoryId = BigInt(Math.floor(Date.now() * 1000 + i + 20000 + Math.random() * 1000));

    const createdTrade = await prisma.trade.create({
      data: {
        userId: testUser.id,
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
      `   ✅ Trade ${i + 1}: ${trade.symbol} ${trade.side} ${trade.amount} @ $${trade.price} (fee: $${trade.fee})`
    );
  }

  // Step 5: Calculate commissions for all 3 tiers
  console.log('\n💰 Calculating referral commissions for all 3 tiers...');

  // Get all referrers for the test user
  const userReferrals = await prisma.referral.findMany({
    where: { referredId: testUser.id },
    include: {
      referrer: { select: { id: true, handle: true } },
    },
    orderBy: { tier: 'asc' },
  });

  console.log(`\n📋 Referrers who will earn commissions:`);
  userReferrals.forEach((r) => {
    const rate = COMMISSION_RATES[r.tier as 1 | 2 | 3];
    console.log(`   T${r.tier}: ${r.referrer.handle || r.referrer.id.slice(0, 8)} (${(rate * 100).toFixed(0)}%)`);
  });

  let totalEarningsCreated = 0;

  for (const trade of createdTrades) {
    const feeNum = parseFloat(trade.fee);
    const tradeValue = parseFloat(trade.amount) * parseFloat(trade.price);

    console.log(`\n   📝 Processing trade ${trade.id.slice(0, 8)}... (${trade.symbol}, fee: $${feeNum.toFixed(2)})`);

    for (const referral of userReferrals) {
      const commissionRate = COMMISSION_RATES[referral.tier as 1 | 2 | 3];
      const commissionAmount = feeNum * commissionRate;

      await prisma.referralEarning.create({
        data: {
          referrerId: referral.referrerId,
          traderId: testUser.id,
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
        `      T${referral.tier}: ${referral.referrer.handle || referral.referrer.id.slice(0, 8)} earns $${commissionAmount.toFixed(4)} (${(commissionRate * 100).toFixed(0)}% of $${feeNum.toFixed(2)})`
      );
      totalEarningsCreated++;
    }
  }

  console.log(`\n✅ Created ${totalEarningsCreated} referral earnings records (3 tiers × 3 trades = 9)`);

  // Step 6: Summary
  const totalFees = testTrades.reduce((sum, t) => sum + parseFloat(t.fee), 0);

  console.log('\n' + '═'.repeat(60));
  console.log('📈 T3 TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`\nTotal fees generated: $${totalFees.toFixed(2)}`);
  console.log(`\nCommissions by tier:`);
  console.log(`   T1 (34%): $${(totalFees * COMMISSION_RATES[1]).toFixed(4)} → ${userReferrals.find(r => r.tier === 1)?.referrer.handle || 'T1 referrer'}`);
  console.log(`   T2 (12%): $${(totalFees * COMMISSION_RATES[2]).toFixed(4)} → ${userReferrals.find(r => r.tier === 2)?.referrer.handle || 'T2 referrer'}`);
  console.log(`   T3 (4%):  $${(totalFees * COMMISSION_RATES[3]).toFixed(4)} → ${userReferrals.find(r => r.tier === 3)?.referrer.handle || 'T3 referrer'}`);
  console.log(`   Total:    $${(totalFees * (COMMISSION_RATES[1] + COMMISSION_RATES[2] + COMMISSION_RATES[3])).toFixed(4)} (50% of fees)`);

  // Step 7: Show updated totals for all referrers
  console.log('\n📊 Updated Totals by Referrer:');

  for (const referral of userReferrals) {
    const earnings = await prisma.referralEarning.aggregate({
      where: {
        referrerId: referral.referrerId,
        isPaid: false,
      },
      _sum: {
        commissionAmount: true,
      },
      _count: true,
    });

    console.log(`\n   ${referral.referrer.handle || referral.referrer.id.slice(0, 8)}:`);
    console.log(`     Total unclaimed: $${earnings._sum.commissionAmount?.toNumber().toFixed(4) || '0.0000'}`);
    console.log(`     Earnings count: ${earnings._count}`);
  }

  // Cleanup instructions
  console.log('\n' + '═'.repeat(60));
  console.log('🗑️ CLEANUP INSTRUCTIONS');
  console.log('═'.repeat(60));
  console.log('\nTo clean up T3 test data, run:');
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
  console.log('');
  console.log('-- Delete test referrals');
  console.log(`DELETE FROM referrals WHERE referred_id = '${testUser.id}';`);
  console.log('');
  console.log('-- Delete test user');
  console.log(`DELETE FROM users WHERE id = '${testUser.id}';`);

  console.log('\n✅ T3 Test completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
