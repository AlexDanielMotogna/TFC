/**
 * Manual runner for referral payout processor
 * Usage: node run-payout-processor.mjs
 */

import { processReferralPayouts } from './dist/jobs/referral-payout-processor.js';

async function main() {
  console.log('[Manual Run] Starting referral payout processor...');

  try {
    const result = await processReferralPayouts();
    console.log('[Manual Run] ✅ Completed successfully:', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('[Manual Run] ❌ Error:', error);
    process.exit(1);
  }
}

main();
