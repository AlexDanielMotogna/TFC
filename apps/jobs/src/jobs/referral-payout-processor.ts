/**
 * Referral Payout Processor Job
 *
 * Processes pending referral payouts by:
 * 1. Finding all pending/failed payouts
 * 2. Attempting USDC transfer via Treasury
 * 3. Updating status to completed or failed
 * 4. Retry logic with exponential backoff (max 3 attempts)
 *
 * Runs every 15 minutes via cron
 */

import { prisma } from '@tfc/db';
import * as Treasury from '../lib/treasury.js';

// Maximum retry attempts before marking as failed
const MAX_RETRY_ATTEMPTS = 3;

// Retry delay in minutes (exponential backoff)
const RETRY_DELAYS = [0, 15, 60]; // 0min (first try), 15min, 60min

interface PayoutProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

/**
 * Process all pending and retryable failed payouts
 */
export async function processReferralPayouts(): Promise<PayoutProcessResult> {
  const result: PayoutProcessResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Find all payouts that need processing
    // Include: pending, and failed payouts within retry window
    const pendingPayouts = await prisma.referralPayout.findMany({
      where: {
        OR: [
          // All pending payouts
          { status: 'pending' },
          // Failed payouts that haven't exceeded max retries
          {
            status: 'failed',
            createdAt: {
              // Only retry payouts from last 24 hours
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`[Referral Payout Processor] Found ${pendingPayouts.length} payouts to process`);

    for (const payout of pendingPayouts) {
      result.processed++;

      try {
        // Calculate retry attempt number
        const retryAttempt = payout.status === 'failed' ? await getRetryAttempt(payout.id) : 0;

        // Check if we've exceeded max retries
        if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
          console.log(`[Referral Payout Processor] Max retries exceeded:`, {
            payoutId: payout.id,
            userId: payout.userId,
            attempts: retryAttempt,
          });
          result.skipped++;
          continue;
        }

        // Check retry delay (exponential backoff)
        if (payout.status === 'failed' && payout.processedAt) {
          const delayMinutes = RETRY_DELAYS[retryAttempt] || 60;
          const nextRetryTime = new Date(payout.processedAt.getTime() + delayMinutes * 60 * 1000);

          if (new Date() < nextRetryTime) {
            console.log(`[Referral Payout Processor] Too soon to retry:`, {
              payoutId: payout.id,
              nextRetryTime: nextRetryTime.toISOString(),
            });
            result.skipped++;
            continue;
          }
        }

        console.log(`[Referral Payout Processor] Processing payout:`, {
          payoutId: payout.id,
          userId: payout.userId,
          amount: Number(payout.amount),
          attempt: retryAttempt + 1,
        });

        // Update status to processing
        await prisma.referralPayout.update({
          where: { id: payout.id },
          data: { status: 'processing' },
        });

        // Check treasury can fulfill payout
        const { canFulfill, reason, balances } = await Treasury.canFulfillClaim(Number(payout.amount));

        if (!canFulfill) {
          console.error(`[Referral Payout Processor] Treasury cannot fulfill payout:`, {
            payoutId: payout.id,
            userId: payout.userId,
            amount: Number(payout.amount),
            reason,
            balances,
          });

          // Mark as failed (will retry on next run)
          await prisma.referralPayout.update({
            where: { id: payout.id },
            data: {
              status: 'failed',
              processedAt: new Date(),
            },
          });

          result.failed++;
          continue;
        }

        // Execute USDC transfer
        const transferResult = await Treasury.processClaim(payout.walletAddress, Number(payout.amount));

        if (!transferResult.success) {
          console.error(`[Referral Payout Processor] Transfer failed:`, {
            payoutId: payout.id,
            userId: payout.userId,
            amount: Number(payout.amount),
            error: transferResult.error,
          });

          // Mark as failed (will retry on next run)
          await prisma.referralPayout.update({
            where: { id: payout.id },
            data: {
              status: 'failed',
              processedAt: new Date(),
            },
          });

          result.failed++;
          continue;
        }

        // Success! Update payout with transaction signature
        await prisma.referralPayout.update({
          where: { id: payout.id },
          data: {
            status: 'completed',
            txSignature: transferResult.signature,
            processedAt: new Date(),
          },
        });

        console.log(`[Referral Payout Processor] Payout completed:`, {
          payoutId: payout.id,
          userId: payout.userId,
          amount: Number(payout.amount),
          txSignature: transferResult.signature,
        });

        result.succeeded++;
      } catch (error) {
        console.error(`[Referral Payout Processor] Error processing payout:`, {
          payoutId: payout.id,
          userId: payout.userId,
          error: error instanceof Error ? error.message : String(error),
        });

        // Mark as failed (will retry on next run)
        await prisma.referralPayout.update({
          where: { id: payout.id },
          data: {
            status: 'failed',
            processedAt: new Date(),
          },
        });

        result.failed++;
      }
    }

    console.log(`[Referral Payout Processor] Batch complete:`, result);
    return result;
  } catch (error) {
    console.error(`[Referral Payout Processor] Fatal error:`, error);
    throw error;
  }
}

/**
 * Get the number of retry attempts for a failed payout
 * Counts how many times processedAt has been updated
 */
async function getRetryAttempt(payoutId: string): Promise<number> {
  // Simple approach: Check how old the payout is and estimate retries
  // For more accurate tracking, you could add a retryCount column to the schema
  const payout = await prisma.referralPayout.findUnique({
    where: { id: payoutId },
    select: { createdAt: true, processedAt: true },
  });

  if (!payout || !payout.processedAt) return 0;

  const ageMinutes = (Date.now() - payout.createdAt.getTime()) / (60 * 1000);

  // Estimate based on retry delays
  if (ageMinutes < 15) return 1;
  if (ageMinutes < 60) return 2;
  return 3;
}
