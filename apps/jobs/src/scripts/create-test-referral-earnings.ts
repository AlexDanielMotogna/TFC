/**
 * Create test referral earnings for testing claim system
 *
 * Usage: tsx src/scripts/create-test-referral-earnings.ts
 */

import { prisma } from '@/lib/server/db';
import { randomUUID } from 'crypto';

const TEST_USER_ID = 'b4470db3-586c-4507-a947-9a41c9618ecb'; // Your user ID
const TEST_TRADER_ID = '1a867a43-70ca-40d3-867c-5370c98c8d50'; // Some other user (your referrer)

async function main() {
  console.log('[Test Data] Creating referral earnings...');

  // Create 3 test earnings totaling ~$0.15 (above $0.05 minimum)
  const earnings = [
    {
      id: randomUUID(),
      referrerId: TEST_USER_ID,
      traderId: TEST_TRADER_ID,
      tradeId: randomUUID(),
      tier: 1,
      symbol: 'BTC-USD',
      tradeFee: '0.10',
      tradeValue: '100.00',
      commissionPercent: '0.20', // 20% tier 1
      commissionAmount: '0.05', // $0.05
      isPaid: false,
    },
    {
      id: randomUUID(),
      referrerId: TEST_USER_ID,
      traderId: TEST_TRADER_ID,
      tradeId: randomUUID(),
      tier: 1,
      symbol: 'ETH-USD',
      tradeFee: '0.15',
      tradeValue: '150.00',
      commissionPercent: '0.20',
      commissionAmount: '0.05', // $0.05
      isPaid: false,
    },
    {
      id: randomUUID(),
      referrerId: TEST_USER_ID,
      traderId: TEST_TRADER_ID,
      tradeId: randomUUID(),
      tier: 1,
      symbol: 'SOL-USD',
      tradeFee: '0.20',
      tradeValue: '200.00',
      commissionPercent: '0.20',
      commissionAmount: '0.05', // $0.05
      isPaid: false,
    },
  ];

  // Create earnings
  for (const earning of earnings) {
    await prisma.referralEarning.create({
      data: earning,
    });
    console.log(`[Test Data] Created earning: ${earning.symbol} - $${earning.commissionAmount}`);
  }

  // Calculate total
  const total = earnings.reduce((sum, e) => sum + parseFloat(e.commissionAmount), 0);
  console.log(`\n[Test Data] ✅ Created ${earnings.length} test earnings`);
  console.log(`[Test Data] 💰 Total available to claim: $${total.toFixed(2)}`);
  console.log(`[Test Data] 👤 User ID: ${TEST_USER_ID}`);
  console.log(`\n[Test Data] You can now test the claim endpoint!`);
  console.log(`[Test Data] POST /api/referrals/claim with your auth token`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
