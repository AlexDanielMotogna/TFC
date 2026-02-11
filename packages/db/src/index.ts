import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Log DATABASE_URL availability for debugging
if (!process.env.DATABASE_URL) {
  console.error('[Prisma] WARNING: DATABASE_URL not found in environment');
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: process.env.DATABASE_URL ? {
      db: { url: process.env.DATABASE_URL }
    } : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Re-export Prisma types
export * from '@prisma/client';

// Export settlement lock utilities
export * from './settlement-lock.js';

// Export the client instance as default
export default prisma;
