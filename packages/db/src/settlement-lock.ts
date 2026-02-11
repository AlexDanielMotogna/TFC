/**
 * Fight Settlement Lock
 *
 * Provides distributed locking mechanism for fight settlement to prevent
 * race conditions between the realtime engine and reconcile-fights job.
 *
 * Uses database fields (settling_at, settling_by) as a distributed lock
 * without requiring Redis or external lock services.
 *
 * @see docs/Agents/Fight-Enginer-Scanner.md
 */

import { PrismaClient, FightStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

/**
 * Maximum time a settlement lock can be held before it's considered stale.
 * If a process crashes or times out, the lock will be released after this duration.
 *
 * Set to 5 minutes to account for slow anti-cheat API calls and network latency.
 * The reconcile-fights job uses a 60-second buffer before attempting to settle,
 * so this timeout should be significantly longer.
 */
export const SETTLEMENT_LOCK_TIMEOUT_MS = 300000; // 5 minutes (300 seconds)

/**
 * Process ID prefixes for identification in logs
 */
export const SETTLEMENT_LOCK_PREFIX = {
  REALTIME: 'realtime',
  JOB_RECONCILE: 'job-reconcile',
} as const;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface AcquireLockResult {
  /** Whether the lock was successfully acquired */
  acquired: boolean;
  /** Current fight status (useful for logging) */
  fightStatus?: string;
  /** Process ID that currently holds the lock (if not acquired) */
  settlingBy?: string | null;
  /** Timestamp when the current lock was acquired (if not acquired) */
  settlingAt?: Date | null;
}

export interface ReleaseLockResult {
  /** Whether the lock was successfully released */
  released: boolean;
}

// ─────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Attempts to acquire the settlement lock for a fight.
 *
 * Uses a transaction with SELECT FOR UPDATE to ensure true row-level locking.
 * This prevents race conditions where two processes could both acquire the lock
 * using concurrent updateMany operations.
 *
 * The lock is acquired if:
 * - The fight is still LIVE
 * - No other process holds the lock (settling_at is NULL), OR
 * - The existing lock has expired (settling_at < now - timeout)
 *
 * @param prisma - Prisma client instance
 * @param fightId - ID of the fight to lock
 * @param processId - Identifier of the process acquiring the lock (e.g., "realtime-abc123")
 * @returns Result indicating whether the lock was acquired
 *
 * @example
 * ```typescript
 * const result = await acquireSettlementLock(prisma, fightId, `realtime-${instanceId}`);
 * if (!result.acquired) {
 *   console.log(`Lock held by ${result.settlingBy}`);
 *   return;
 * }
 * // Proceed with settlement...
 * ```
 */
export async function acquireSettlementLock(
  prisma: PrismaClient,
  fightId: string,
  processId: string
): Promise<AcquireLockResult> {
  const lockTimeout = new Date(Date.now() - SETTLEMENT_LOCK_TIMEOUT_MS);

  try {
    console.log(`[SettlementLock] Acquiring lock for fight ${fightId} by ${processId}`);

    // Use transaction with FOR UPDATE to get true row-level locking
    // This blocks other processes from reading/modifying until we commit
    const result = await prisma.$transaction(async (tx) => {
      // Lock the row with FOR UPDATE - this blocks concurrent access
      const lockedRows = await tx.$queryRaw<Array<{
        id: string;
        status: string;
        settling_at: Date | null;
        settling_by: string | null;
      }>>`
        SELECT id, status, settling_at, settling_by
        FROM fights
        WHERE id = ${fightId}
        FOR UPDATE
      `;

      const fight = lockedRows[0];
      if (!fight) {
        console.log(`[SettlementLock] Fight ${fightId} not found`);
        return { acquired: false, reason: 'not_found' };
      }

      console.log(`[SettlementLock] Fight ${fightId} state:`, {
        status: fight.status,
        settlingBy: fight.settling_by,
        settlingAt: fight.settling_at,
        lockTimeout: lockTimeout.toISOString(),
      });

      // Check if fight is still LIVE
      if (fight.status !== 'LIVE') {
        console.log(`[SettlementLock] Fight ${fightId} not LIVE (status: ${fight.status})`);
        return {
          acquired: false,
          fightStatus: fight.status,
          settlingBy: fight.settling_by,
          settlingAt: fight.settling_at,
        };
      }

      // Check if lock is available (null or expired)
      const lockIsAvailable =
        fight.settling_at === null ||
        fight.settling_at < lockTimeout;

      if (!lockIsAvailable) {
        console.log(`[SettlementLock] Fight ${fightId} lock held by ${fight.settling_by} (acquired at ${fight.settling_at})`);
        return {
          acquired: false,
          fightStatus: fight.status,
          settlingBy: fight.settling_by,
          settlingAt: fight.settling_at,
        };
      }

      // Acquire the lock
      await tx.fight.update({
        where: { id: fightId },
        data: {
          settlingAt: new Date(),
          settlingBy: processId,
        },
      });

      console.log(`[SettlementLock] ✅ Lock acquired for fight ${fightId} by ${processId}`);
      return { acquired: true };
    });

    return result;
  } catch (error) {
    // In case of DB error, return not acquired to prevent settlement
    console.error('[SettlementLock] Failed to acquire lock:', error);
    return { acquired: false };
  }
}

/**
 * Releases the settlement lock for a fight.
 *
 * Only releases the lock if the calling process is the current holder.
 * This prevents accidentally releasing another process's lock.
 *
 * @param prisma - Prisma client instance
 * @param fightId - ID of the fight to unlock
 * @param processId - Identifier of the process releasing the lock
 * @returns Result indicating whether the lock was released
 *
 * @example
 * ```typescript
 * try {
 *   // Settlement logic...
 * } catch (error) {
 *   await releaseSettlementLock(prisma, fightId, processId);
 *   throw error;
 * }
 * ```
 */
export async function releaseSettlementLock(
  prisma: PrismaClient,
  fightId: string,
  processId: string
): Promise<ReleaseLockResult> {
  try {
    const result = await prisma.fight.updateMany({
      where: {
        id: fightId,
        settlingBy: processId, // Only release if we hold the lock
      },
      data: {
        settlingAt: null,
        settlingBy: null,
      },
    });

    return { released: result.count > 0 };
  } catch (error) {
    console.error('[SettlementLock] Failed to release lock:', error);
    return { released: false };
  }
}

/**
 * Checks if a lock has expired based on its timestamp.
 *
 * @param settlingAt - Timestamp when the lock was acquired
 * @returns true if the lock has expired or is null
 */
export function isLockExpired(settlingAt: Date | null): boolean {
  if (!settlingAt) return true;
  return Date.now() - settlingAt.getTime() > SETTLEMENT_LOCK_TIMEOUT_MS;
}

/**
 * Generates a unique process ID for lock identification.
 *
 * @param prefix - Process type prefix (e.g., "realtime", "job-reconcile")
 * @param instanceId - Optional instance identifier
 * @returns Formatted process ID
 */
export function generateProcessId(prefix: string, instanceId?: string): string {
  const id = instanceId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${id}`;
}
