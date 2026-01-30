/**
 * Fix: Create test earning for a user OTHER than treasury
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TREASURY_WALLET = 'FQUc4RGM6MHxBXjWJRzFmVQYr1yBsgrMLBYXeY9uFd1k';

async function main() {
  console.log('🔧 Fixing test earning...\n');

  // Delete the wrong test earning
  const deleted = await prisma.referralEarning.deleteMany({
    where: { symbol: 'TEST' }
  });
  console.log(`Deleted ${deleted.count} TEST earnings`);

  // Find a user that is NOT the treasury wallet
  const user = await prisma.user.findFirst({
    where: {
      walletAddress: { not: TREASURY_WALLET },
      AND: { walletAddress: { not: null } }
    },
    select: { id: true, handle: true, walletAddress: true }
  });

  if (!user) {
    console.log('❌ No other user with wallet found');
    return;
  }

  console.log(`\nTarget user: ${user.handle}`);
  console.log(`Wallet: ${user.walletAddress}`);

  // Create earning for this user
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

  console.log(`\n✅ Created $0.10 earning for: ${user.handle}`);
  console.log(`\n📋 Test flow:`);
  console.log(`   1. Login with wallet: ${user.walletAddress}`);
  console.log(`   2. Go to /referrals`);
  console.log(`   3. Click Claim`);
  console.log(`   4. Treasury (${TREASURY_WALLET.slice(0,8)}...) pays $0.10 USDC to ${user.walletAddress?.slice(0,8)}...`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
