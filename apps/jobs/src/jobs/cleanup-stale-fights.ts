import { prisma, FightStatus } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';

const logger = createLogger({ service: 'job' });

// Cancel WAITING fights older than this
const STALE_THRESHOLD_MINUTES = 15;

/**
 * Cleanup stale WAITING fights
 * Fights that have been waiting for an opponent for too long are cancelled
 */
export async function cleanupStaleFights(): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  // Find stale fights
  const staleFights = await prisma.fight.findMany({
    where: {
      status: FightStatus.WAITING,
      createdAt: { lt: staleThreshold },
    },
    select: { id: true, creatorId: true, createdAt: true },
  });

  if (staleFights.length === 0) {
    return 0;
  }

  // Cancel them
  const result = await prisma.fight.updateMany({
    where: {
      id: { in: staleFights.map((f) => f.id) },
      status: FightStatus.WAITING, // Double check status hasn't changed
    },
    data: {
      status: FightStatus.CANCELLED,
    },
  });

  // Log each cancelled fight
  for (const fight of staleFights) {
    logger.info(LOG_EVENTS.FIGHT_CLEANUP_SUCCESS, 'Cancelled stale fight', {
      fightId: fight.id,
      creatorId: fight.creatorId,
      createdAt: fight.createdAt.toISOString(),
    });
  }

  return result.count;
}
