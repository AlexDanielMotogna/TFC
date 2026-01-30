import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.referralEarning.count();
  console.log('Total earnings:', count);

  if (count > 0) {
    const earnings = await prisma.referralEarning.findMany({
      take: 5,
      orderBy: { earnedAt: 'desc' },
    });
    console.log('Recent earnings:', JSON.stringify(earnings, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
