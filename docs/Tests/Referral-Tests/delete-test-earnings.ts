import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Delete TEST symbol earnings
  const del = await prisma.referralEarning.deleteMany({
    where: { symbol: 'TEST' }
  });
  console.log('Deleted TEST earnings:', del.count);

  // Verify
  const count = await prisma.referralEarning.count();
  console.log('Total earnings remaining:', count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
