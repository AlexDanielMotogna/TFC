/**
 * Script to re-finalize a specific week's prize pool
 * Usage: npx tsx apps/jobs/src/scripts/re-finalize-week.ts [YYYY-MM-DD]
 *
 * If no date provided, defaults to re-finalizing Jan 11-17, 2026
 */
import 'dotenv/config';
import { prisma, PrizeStatus, FightStatus } from '@tfc/db';

// Prize percentages for top 3
const PRIZE_PERCENTAGES: Record<number, number> = {
  1: 5.0,  // 1st place: 5%
  2: 3.0,  // 2nd place: 3%
  3: 2.0,  // 3rd place: 2%
};

interface UserStats {
  userId: string;
  userHandle: string;
  totalFights: number;
  wins: number;
  losses: number;
  totalPnlUsdc: number;
}

function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  const dayOfWeek = d.getUTCDay();
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dayOfWeek);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

async function refinalizeWeek(dateInWeek: Date) {
  const { start: weekStart, end: weekEnd } = getWeekBoundaries(dateInWeek);

  console.log(`\n🔄 Re-finalizing week: ${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}\n`);

  // First, reset the pool to allow re-finalization
  const existingPool = await prisma.weeklyPrizePool.findUnique({
    where: { weekStartDate: weekStart },
    include: { prizes: true },
  });

  if (existingPool) {
    console.log('📋 Existing pool status:');
    console.log(`   Finalized: ${existingPool.isFinalized}`);
    console.log(`   Total Fees: $${Number(existingPool.totalFeesCollected).toFixed(4)}`);
    console.log(`   Prize Pool: $${Number(existingPool.totalPrizePool).toFixed(4)}`);
    console.log(`   Existing prizes: ${existingPool.prizes.length}`);

    // Delete existing prizes to allow re-creation
    if (existingPool.prizes.length > 0) {
      console.log('\n🗑️  Deleting existing prizes...');
      await prisma.weeklyPrize.deleteMany({
        where: { prizePoolId: existingPool.id },
      });
    }

    // Reset finalized status
    console.log('🔓 Resetting finalized status...');
    await prisma.weeklyPrizePool.update({
      where: { id: existingPool.id },
      data: { isFinalized: false, finalizedAt: null },
    });
  }

  // Calculate total builder code fees for the week
  console.log('\n💰 Calculating fees...');
  const feesResult = await prisma.$queryRaw<[{ builder_fees: number }]>`
    SELECT COALESCE(SUM(amount * price) * 0.0005, 0)::float as builder_fees
    FROM trades
    WHERE executed_at >= ${weekStart} AND executed_at <= ${weekEnd}
  `;
  const totalFees = feesResult[0]?.builder_fees || 0;
  const totalPrizePool = totalFees * 0.10;

  console.log(`   Total Fees: $${totalFees.toFixed(4)}`);
  console.log(`   Prize Pool (10%): $${totalPrizePool.toFixed(4)}`);

  // Calculate top 3 directly from fights in the week
  console.log('\n🏆 Calculating rankings from fights...');
  const participants = await prisma.fightParticipant.findMany({
    where: {
      fight: {
        status: FightStatus.FINISHED,
        startedAt: { gte: weekStart, lte: weekEnd },
      },
    },
    include: {
      fight: {
        select: {
          winnerId: true,
          isDraw: true,
        },
      },
      user: {
        select: {
          id: true,
          handle: true,
        },
      },
    },
  });

  console.log(`   Found ${participants.length} fight participants`);

  // Aggregate stats by user
  const userStatsMap = new Map<string, UserStats>();

  for (const p of participants) {
    const userId = p.userId;

    if (!userStatsMap.has(userId)) {
      userStatsMap.set(userId, {
        userId,
        userHandle: p.user.handle,
        totalFights: 0,
        wins: 0,
        losses: 0,
        totalPnlUsdc: 0,
      });
    }

    const stats = userStatsMap.get(userId)!;
    stats.totalFights++;

    if (!p.fight.isDraw) {
      if (p.fight.winnerId === userId) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    }

    if (p.finalScoreUsdc) {
      stats.totalPnlUsdc += Number(p.finalScoreUsdc);
    }
  }

  // Get top 3 sorted by PnL
  const topUsers = Array.from(userStatsMap.values())
    .sort((a, b) => b.totalPnlUsdc - a.totalPnlUsdc)
    .slice(0, 3)
    .map((stats, index) => ({
      ...stats,
      rank: index + 1,
    }));

  console.log(`   Unique users: ${userStatsMap.size}`);
  console.log(`   Top 3 users: ${topUsers.length}`);

  if (topUsers.length === 0) {
    console.log('\n❌ No users found for this week. No prizes to create.');

    await prisma.weeklyPrizePool.upsert({
      where: { weekStartDate: weekStart },
      create: {
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        totalFeesCollected: totalFees,
        totalPrizePool: 0,
        isFinalized: true,
        finalizedAt: new Date(),
      },
      update: {
        totalFeesCollected: totalFees,
        totalPrizePool: 0,
        isFinalized: true,
        finalizedAt: new Date(),
      },
    });
    return;
  }

  // Create or update the prize pool
  const prizePool = await prisma.weeklyPrizePool.upsert({
    where: { weekStartDate: weekStart },
    create: {
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      totalFeesCollected: totalFees,
      totalPrizePool,
      isFinalized: true,
      finalizedAt: new Date(),
    },
    update: {
      totalFeesCollected: totalFees,
      totalPrizePool,
      isFinalized: true,
      finalizedAt: new Date(),
    },
  });

  // Create prize records for top 3
  console.log('\n🎁 Creating prize records...');
  for (const entry of topUsers) {
    const rank = entry.rank;
    const percentage = PRIZE_PERCENTAGES[rank] || 0;
    const amount = (totalFees * percentage) / 100;

    const prize = await prisma.weeklyPrize.upsert({
      where: {
        prizePoolId_rank: {
          prizePoolId: prizePool.id,
          rank,
        },
      },
      create: {
        prizePoolId: prizePool.id,
        userId: entry.userId,
        rank,
        prizePercentage: percentage,
        prizeAmount: amount,
        totalPnlUsdc: entry.totalPnlUsdc,
        totalFights: entry.totalFights,
        wins: entry.wins,
        userHandle: entry.userHandle,
        status: PrizeStatus.EARNED,
      },
      update: {
        userId: entry.userId,
        prizePercentage: percentage,
        prizeAmount: amount,
        totalPnlUsdc: entry.totalPnlUsdc,
        totalFights: entry.totalFights,
        wins: entry.wins,
        userHandle: entry.userHandle,
        status: PrizeStatus.EARNED,
      },
    });

    console.log(`   ${rank}. @${entry.userHandle}`);
    console.log(`      PnL: $${entry.totalPnlUsdc.toFixed(4)}`);
    console.log(`      Prize: $${amount.toFixed(4)} (${percentage}%)`);
    console.log(`      Status: ${prize.status}`);
  }

  console.log('\n✅ Week re-finalized successfully!');
  console.log(`   Prize Pool ID: ${prizePool.id}`);
  console.log(`   Total prizes created: ${topUsers.length}`);

  await prisma.$disconnect();
}

// Parse command line argument or use default date
const dateArg = process.argv[2];
const targetDate = dateArg ? new Date(dateArg) : new Date('2026-01-12'); // Jan 12 falls in week Jan 11-17

refinalizeWeek(targetDate).catch(console.error);
