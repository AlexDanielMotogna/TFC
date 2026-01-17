import 'dotenv/config';
import cron from 'node-cron';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';
import { refreshLeaderboards } from './jobs/leaderboard-refresh.js';
import { cleanupStaleFights } from './jobs/cleanup-stale-fights.js';
import { reconcileFights } from './jobs/reconcile-fights.js';
import { finalizePrizePool, updateCurrentPrizePool } from './jobs/prize-pool-finalize.js';

const logger = createLogger({ service: 'job' });

async function main() {
  logger.info(LOG_EVENTS.API_START, 'Starting jobs service');

  // ─────────────────────────────────────────────────────────────
  // Leaderboard refresh - every 5 minutes
  // @see Master-doc.md Section 11
  // ─────────────────────────────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    logger.info(LOG_EVENTS.LEADERBOARD_REFRESH_START, 'Starting leaderboard refresh');

    try {
      await refreshLeaderboards();
      logger.info(LOG_EVENTS.LEADERBOARD_REFRESH_SUCCESS, 'Leaderboard refresh completed');
    } catch (error) {
      logger.error(
        LOG_EVENTS.LEADERBOARD_REFRESH_FAILURE,
        'Leaderboard refresh failed',
        error as Error
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Cleanup stale WAITING fights - every minute
  // Fights older than 15 minutes without opponent are cancelled
  // ─────────────────────────────────────────────────────────────
  cron.schedule('* * * * *', async () => {
    logger.info(LOG_EVENTS.FIGHT_CLEANUP_START, 'Starting stale fight cleanup');

    try {
      const cleaned = await cleanupStaleFights();
      if (cleaned > 0) {
        logger.info(LOG_EVENTS.FIGHT_CLEANUP_SUCCESS, 'Stale fights cleaned', {
          count: cleaned,
        });
      }
    } catch (error) {
      logger.error(
        LOG_EVENTS.FIGHT_CLEANUP_FAILURE,
        'Stale fight cleanup failed',
        error as Error
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Fight reconciliation - every minute
  // Check for fights that should have ended but weren't processed
  // ─────────────────────────────────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      await reconcileFights();
    } catch (error) {
      logger.error(
        LOG_EVENTS.FIGHT_RECONCILE_FAILURE,
        'Fight reconciliation failed',
        error as Error
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Prize pool finalization - every Sunday at 00:05 UTC
  // Finalizes the previous week's prize pool after leaderboard refresh
  // ─────────────────────────────────────────────────────────────
  cron.schedule('5 0 * * 0', async () => {
    logger.info(LOG_EVENTS.PRIZE_POOL_FINALIZE_START, 'Starting weekly prize pool finalization');

    try {
      await finalizePrizePool();
    } catch (error) {
      logger.error(
        LOG_EVENTS.PRIZE_POOL_FINALIZE_FAILURE,
        'Prize pool finalization failed',
        error as Error
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Prize pool update - every 5 minutes
  // Updates current week's prize pool for real-time display
  // ─────────────────────────────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      await updateCurrentPrizePool();
    } catch (error) {
      logger.error(
        LOG_EVENTS.PRIZE_POOL_FINALIZE_FAILURE,
        'Prize pool update failed',
        error as Error
      );
    }
  });

  logger.info(LOG_EVENTS.API_START, 'Jobs service started, all cron jobs scheduled');

  // Keep process alive
  process.on('SIGTERM', () => {
    logger.info(LOG_EVENTS.API_SHUTDOWN, 'Shutting down jobs service');
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(LOG_EVENTS.API_ERROR, 'Failed to start jobs service', error as Error);
  process.exit(1);
});
