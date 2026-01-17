import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fightId = '07f47471-8763-44fa-9216-b8b6ea83b3df';

  // Get fight info
  const fight = await prisma.fight.findUnique({
    where: { id: fightId },
    include: {
      participants: {
        include: {
          user: true,
        }
      }
    }
  });

  console.log('\n=== FIGHT INFO ===');
  console.log('Status:', fight?.status);
  console.log('Stake:', fight?.stakeUsdc);
  console.log('Started:', fight?.startedAt);

  console.log('\n=== PARTICIPANTS ===');
  fight?.participants.forEach(p => {
    console.log('- ' + p.user.handle + ' (' + p.slot + '): userId=' + p.userId);
    console.log('  Initial Positions:', JSON.stringify(p.initialPositions, null, 2));
    console.log('  Max Exposure Used:', p.maxExposureUsed?.toString());
  });

  // Get all FightTrades for this fight
  const trades = await prisma.fightTrade.findMany({
    where: { fightId },
    orderBy: { executedAt: 'asc' },
  });

  // Get user handles
  const userIds = [...new Set(trades.map(t => t.participantUserId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } }
  });
  const userMap = new Map(users.map(u => [u.id, u.handle]));

  console.log('\n=== FIGHT TRADES ===');
  trades.forEach(t => {
    const time = t.executedAt ? new Date(t.executedAt).toISOString() : 'N/A';
    const handle = userMap.get(t.participantUserId) || t.participantUserId;
    console.log('[' + time + '] ' + handle + ': ' + t.side + ' ' + t.amount + ' ' + t.symbol + ' @ ' + t.price + ' (leverage: ' + t.leverage + ', fee: ' + t.fee + ', pnl: ' + t.pnl + ')');
  });

  // Calculate positions per user
  console.log('\n=== CALCULATED POSITIONS FROM FIGHT TRADES ===');
  const userPositions: Record<string, Record<string, { amount: number; cost: number }>> = {};

  for (const trade of trades) {
    const userId = trade.participantUserId;
    const symbol = trade.symbol;
    if (!userPositions[userId]) userPositions[userId] = {};
    if (!userPositions[userId][symbol]) userPositions[userId][symbol] = { amount: 0, cost: 0 };

    const amount = parseFloat(trade.amount.toString());
    const price = parseFloat(trade.price.toString());

    if (trade.side === 'BUY') {
      userPositions[userId][symbol].amount += amount;
      userPositions[userId][symbol].cost += amount * price;
    } else {
      userPositions[userId][symbol].amount -= amount;
      // For sells, we just reduce amount, cost calculation is more complex
    }
  }

  for (const [userId, positions] of Object.entries(userPositions)) {
    const handle = userMap.get(userId) || userId;
    console.log('\n' + handle + ':');
    for (const [symbol, data] of Object.entries(positions)) {
      const side = data.amount > 0 ? 'LONG' : data.amount < 0 ? 'SHORT' : 'FLAT';
      const avgEntry = data.amount !== 0 ? Math.abs(data.cost / data.amount) : 0;
      console.log('  ' + symbol + ': ' + data.amount.toFixed(8) + ' (' + side + ') avgEntry: $' + avgEntry.toFixed(2));
    }
  }

  // Summary of exposure per user
  console.log('\n=== EXPOSURE CALCULATION ===');
  for (const [userId, positions] of Object.entries(userPositions)) {
    const handle = userMap.get(userId) || userId;
    let totalExposure = 0;
    for (const [symbol, data] of Object.entries(positions)) {
      // Get approximate price for BTC
      const btcPrice = 95000; // approximate
      const solPrice = 147;
      const price = symbol.includes('BTC') ? btcPrice : symbol.includes('SOL') ? solPrice : 100;
      const positionValue = Math.abs(data.amount) * price;
      totalExposure += positionValue;
    }
    console.log(handle + ' total exposure: $' + totalExposure.toFixed(2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
