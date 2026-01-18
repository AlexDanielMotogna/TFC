/**
 * Prisma database client singleton for Next.js API routes
 * Creates own instance to avoid bundling issues with @tfc/db in standalone mode
 * Explicitly passes DATABASE_URL to handle standalone mode env var issues
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Log for debugging in production
if (!process.env.DATABASE_URL) {
  console.error('[Prisma] WARNING: DATABASE_URL not found in environment');
  console.error('[Prisma] Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('DIRECT')));
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: process.env.DATABASE_URL ? {
      db: {
        url: process.env.DATABASE_URL,
      },
    } : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
