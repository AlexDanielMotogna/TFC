/**
 * Test script to verify prize pool finalization flow
 * Run with: npx tsx apps/jobs/src/scripts/test-prize-finalization.ts
 */
import 'dotenv/config';
import { prisma, PrizeStatus } from '@tfc/db';

async function testPrizeFinalization() {
  console.log('🧪 Testing Prize Pool Finalization Flow\n');

  // 1. Check weekly leaderboard snapshot
  console.log('1️⃣ Checking weekly leaderboard (top 3)...');
  const weeklyLeaders = await prisma.leaderboardSnapshot.findMany({
    where: {
      range: 'weekly',
      rank: { lte: 3 },
    },
    orderBy: { rank: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          walletAddress: true,
        },
      },
    },
  });

  if (weeklyLeaders.length === 0) {
    console.log('   ❌ No users in weekly leaderboard with rank <= 3');
    console.log('   This is why no prizes are being created!\n');

    // Check if there's any leaderboard data at all
    const anyLeaders = await prisma.leaderboardSnapshot.findMany({
      where: { range: 'weekly' },
      take: 5,
      orderBy: { rank: 'asc' },
    });

    if (anyLeaders.length === 0) {
      console.log('   ℹ️  No weekly leaderboard data exists at all');
      console.log('   Make sure the leaderboard refresh job is running\n');
    } else {
      console.log(`   ℹ️  Found ${anyLeaders.length} users in weekly leaderboard but all rank > 3`);
      console.log('   First user rank:', anyLeaders[0]?.rank);
    }
  } else {
    console.log(`   ✅ Found ${weeklyLeaders.length} users in top 3:`);
    weeklyLeaders.forEach((entry) => {
      console.log(`      ${entry.rank}. @${entry.user.handle} (${entry.userId})`);
      console.log(`         PnL: $${Number(entry.totalPnlUsdc).toFixed(2)}`);
      console.log(`         Wallet: ${entry.user.walletAddress || 'NOT SET'}`);
    });
    console.log('');
  }

  // 2. Check current week's prize pool
  console.log('2️⃣ Checking current week prize pool...');
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(now.getUTCDate() - dayOfWeek);

  const currentPool = await prisma.weeklyPrizePool.findUnique({
    where: { weekStartDate: weekStart },
  });

  if (currentPool) {
    console.log(`   Week: ${weekStart.toISOString().split('T')[0]} to ${currentPool.weekEndDate.toISOString().split('T')[0]}`);
    console.log(`   Total Fees: $${Number(currentPool.totalFeesCollected).toFixed(4)}`);
    console.log(`   Prize Pool (10%): $${Number(currentPool.totalPrizePool).toFixed(4)}`);
    console.log(`   Finalized: ${currentPool.isFinalized}`);
    console.log('');
  } else {
    console.log('   ❌ No prize pool record for current week\n');
  }

  // 3. Check all prize pools
  console.log('3️⃣ All prize pools in database:');
  const allPools = await prisma.weeklyPrizePool.findMany({
    orderBy: { weekStartDate: 'desc' },
    include: {
      prizes: true,
    },
  });

  if (allPools.length === 0) {
    console.log('   No prize pools found\n');
  } else {
    allPools.forEach((pool) => {
      console.log(`   📅 ${pool.weekStartDate.toISOString().split('T')[0]} to ${pool.weekEndDate.toISOString().split('T')[0]}`);
      console.log(`      Fees: $${Number(pool.totalFeesCollected).toFixed(4)}`);
      console.log(`      Pool: $${Number(pool.totalPrizePool).toFixed(4)}`);
      console.log(`      Finalized: ${pool.isFinalized}`);
      console.log(`      Prizes: ${pool.prizes.length}`);
      pool.prizes.forEach((prize) => {
        console.log(`         ${prize.rank}. @${prize.userHandle} - $${Number(prize.prizeAmount).toFixed(2)} (${prize.status})`);
      });
      console.log('');
    });
  }

  // 4. Check all prizes
  console.log('4️⃣ All prizes in database:');
  const allPrizes = await prisma.weeklyPrize.findMany({
    orderBy: { createdAt: 'desc' },
  });

  if (allPrizes.length === 0) {
    console.log('   No prizes found\n');
  } else {
    allPrizes.forEach((prize) => {
      console.log(`   🏆 Rank ${prize.rank}: @${prize.userHandle}`);
      console.log(`      Amount: $${Number(prize.prizeAmount).toFixed(2)}`);
      console.log(`      Status: ${prize.status}`);
      console.log(`      TX: ${prize.txSignature || 'Not claimed'}`);
    });
  }

  // 5. Summary and recommendations
  console.log('\n📋 Summary & Recommendations:');

  if (weeklyLeaders.length === 0) {
    console.log('   ⚠️  The main issue is: No users in weekly leaderboard with rank <= 3');
    console.log('   This could be because:');
    console.log('   1. No fights completed this week');
    console.log('   2. Leaderboard refresh job not running');
    console.log('   3. Leaderboard logic issue\n');

    console.log('   To fix, check:');
    console.log('   - Run: SELECT * FROM leaderboard_snapshots WHERE range = \'weekly\' ORDER BY rank LIMIT 10;');
    console.log('   - Verify the jobs service is running');
  } else if (currentPool && Number(currentPool.totalPrizePool) > 0) {
    console.log('   ✅ Everything looks ready!');
    console.log(`   On Sunday at 00:05 UTC, ${weeklyLeaders.length} prize(s) will be created:`);

    const PRIZE_PERCENTAGES: Record<number, number> = { 1: 5.0, 2: 3.0, 3: 2.0 };
    const totalFees = Number(currentPool.totalFeesCollected);

    weeklyLeaders.forEach((entry) => {
      const pct = PRIZE_PERCENTAGES[entry.rank || 0] || 0;
      const amount = (totalFees * pct) / 100;
      console.log(`      ${entry.rank}. @${entry.user.handle}: $${amount.toFixed(4)} (${pct}% of fees)`);
    });
  }

  await prisma.$disconnect();
}

testPrizeFinalization().catch(console.error);
