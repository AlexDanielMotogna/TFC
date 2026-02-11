# Prize Claim System Documentation

## Overview
System for claiming weekly prize pool rewards with atomic transaction guarantees to prevent double-claims.

## Security Architecture

### Critical Security Fix (Feb 2026)
**Problem:** User was able to claim the same prize 6 times simultaneously, resulting in 6x payout.

**Root Cause:**
1. Non-atomic operations (validate → transfer → update DB)
2. WebSocket timeout showed error to user, but Solana transfers executed successfully
3. No row-level locking during claim process

**Solution:** Atomic transactions with pessimistic locking (SELECT FOR UPDATE)

## API Endpoint

### POST /api/prize/claim

**Request:**
```json
{
  "prizeId": "uuid-string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "prizeId": "uuid",
  "amount": 200.00,
  "txSignature": "4jg9wLFZ...",
  "explorerUrl": "https://solscan.io/tx/..."
}
```

**Idempotent Response (200) - Already Claimed:**
```json
{
  "success": true,
  "prizeId": "uuid",
  "amount": 200.00,
  "txSignature": "existing-tx-sig",
  "explorerUrl": "https://solscan.io/tx/...",
  "message": "Prize was already claimed"
}
```

**Error Responses:**

| Code | Error | Reason |
|------|-------|--------|
| 400 | Prize already claimed | Status is DISTRIBUTED and no valid tx |
| 400 | Prize not yet available | Status is PENDING or other non-EARNED state |
| 403 | This prize does not belong to you | userId mismatch |
| 404 | Prize not found | Invalid prizeId |
| 409 | Another claim is being processed | Concurrent claim detected (serialization failure) |
| 503 | Technical issue with prize distribution | Treasury insufficient funds |
| 503 | Failed to process prize transfer | Solana transfer failed |

## Transaction Flow

```
Client → API: POST /api/prize/claim
API → DB: BEGIN TRANSACTION (Serializable)
DB → DB: SELECT * FROM weekly_prizes WHERE id = X FOR UPDATE
         (Row locked - no other tx can read/write)

API: Validate status = EARNED
API: Validate ownership
API: Check treasury balance

API → Solana: Transfer USDC
Solana → API: Signature + Confirmation

API → DB: UPDATE status = DISTRIBUTED
API → DB: COMMIT

DB → API: Success
API → Client: 200 OK + txSignature
```

## Security Guarantees

### 1. Row-Level Locking
```sql
SELECT * FROM weekly_prizes WHERE id = ? FOR UPDATE
```
- Locks the prize row for the duration of the transaction
- Other transactions attempting to claim the same prize will **wait** until lock is released
- If transaction fails/rolls back, lock is released automatically

### 2. Serializable Isolation Level
```typescript
prisma.$transaction(async (tx) => {
  // ... claim logic ...
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 30000,
  timeout: 30000
})
```

**Guarantees:**
- Highest isolation level in PostgreSQL
- Prevents phantom reads, dirty reads, non-repeatable reads
- Concurrent transactions execute as if they ran serially

### 3. Atomic Operations
All operations happen in a single transaction:
1. Lock row
2. Validate status
3. Execute Solana transfer
4. Update DB status
5. Create notification

**If ANY step fails:** Entire transaction rolls back (no orphaned state)

### 4. Idempotent Responses
If prize is already claimed with valid tx signature:
- Returns 200 OK with existing transaction details
- Does NOT execute new transfer
- Safe for client retries

## Testing Double-Claim Prevention

### Manual Test
```bash
# Simulate 6 concurrent requests
TOKEN="your-auth-token"
PRIZE_ID="prize-uuid"

for i in {1..6}; do
  curl -X POST http://localhost:3000/api/prize/claim \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"prizeId\":\"$PRIZE_ID\"}" &
done
wait
```

**Expected Result:**
- 1st request: 200 OK + transfer executed
- Requests 2-6: One of:
  - 409 CONCURRENT_CLAIM (if hit serialization conflict)
  - 200 OK with existing tx (if idempotent check triggered)
  - Wait until first tx completes, then 400 "Already claimed"

## Database Schema

```prisma
model WeeklyPrize {
  id            String       @id @default(uuid())
  prizePoolId   String       @map("prize_pool_id")
  userId        String       @map("user_id")
  rank          Int
  prizeAmount   Decimal      @map("prize_amount")

  status        PrizeStatus  @default(PENDING)
  distributedAt DateTime?    @map("distributed_at")
  txSignature   String?      @map("tx_signature")

  createdAt     DateTime     @default(now()) @map("created_at")

  @@unique([prizePoolId, rank])      // One prize per rank per pool
  @@unique([prizePoolId, userId])    // One prize per user per pool
  @@index([userId])
  @@index([status])
  @@map("weekly_prizes")
}

enum PrizeStatus {
  PENDING      // Prize pool not finalized yet
  EARNED       // User earned prize, ready to claim
  DISTRIBUTED  // Prize claimed and paid out
}
```

## Logging

All claim attempts are logged with:
```typescript
console.log('[Claim] Processing transfer:', {
  prizeId,
  userId,
  amount,
  wallet
});

console.log('[Claim] Transfer successful:', {
  prizeId,
  userId,
  signature
});

console.error('[Claim] Transfer failed:', {
  prizeId,
  userId,
  amount,
  error
});
```

## Treasury Integration

Claims use the Treasury service for USDC transfers:

```typescript
// apps/web/src/lib/server/treasury.ts
export async function processClaim(
  recipientAddress: string,
  amount: number
): Promise<TransferResult>
```

**Security Features:**
- Validates treasury has sufficient SOL for fees (0.01 SOL minimum)
- Validates treasury has sufficient USDC
- Uses polling confirmation (not WebSocket) to avoid false negatives
- Creates recipient ATA if doesn't exist (treasury pays)

## Error Handling

### Serialization Failures
If two transactions conflict (both trying to claim same prize):
```
PostgreSQL: "could not serialize access due to concurrent update"
```

**Handled by:**
```typescript
if (error.message.includes('Serialization failure') ||
    error.message.includes('could not serialize')) {
  return Response.json({
    success: false,
    error: 'Another claim is being processed. Please wait a moment and try again.',
    code: 'CONCURRENT_CLAIM'
  }, { status: 409 });
}
```

### Transfer Failures
If Solana transfer fails:
- Transaction rolls back
- Prize status remains EARNED
- User can retry claim

### Treasury Insufficient Funds
If treasury cannot fulfill claim:
- Error logged for admin notification
- User sees generic error message
- Transaction rolls back

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Failed Claims:** Count of 503 errors (treasury issues)
2. **Concurrent Conflicts:** Count of 409 errors (serialization failures)
3. **Average Claim Time:** Should be < 5 seconds
4. **Treasury Balance:** Alert if < $10,000 USDC or < 0.1 SOL

### Admin Dashboard Queries

**Recent claim attempts:**
```sql
SELECT
  wp.id,
  wp.user_id,
  wp.prize_amount,
  wp.status,
  wp.tx_signature,
  wp.distributed_at
FROM weekly_prizes wp
WHERE wp.status = 'DISTRIBUTED'
ORDER BY wp.distributed_at DESC
LIMIT 100;
```

**Double-claim detection:**
```sql
-- This should return 0 rows (each prize claimed max once)
SELECT
  prize_pool_id,
  rank,
  COUNT(*) as claim_count
FROM weekly_prizes
WHERE status = 'DISTRIBUTED'
GROUP BY prize_pool_id, rank
HAVING COUNT(*) > 1;
```

## Migration Notes

No database migration required. The security fix works with existing schema.

**Deployment Steps:**
1. Deploy updated code
2. Monitor logs for serialization errors (expected if concurrent claims)
3. Verify no double-claims in database
4. Test claim flow end-to-end

## Referral Claim Security

### Endpoint: POST /api/referrals/claim

**Same Security Architecture as Prize Claims**

The referral claim endpoint uses identical security measures to prevent double-claims:
- Atomic transaction with Serializable isolation
- `SELECT FOR UPDATE` on referral_earnings table
- Idempotent responses for safe retries
- Two-phase processing: claim creates payout, cron job processes transfer

### API Endpoint

**Request:**
```json
POST /api/referrals/claim
Headers: Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "payout": {
    "id": "payout-uuid",
    "amount": 25.50,
    "status": "pending",
    "walletAddress": "...",
    "createdAt": "2026-02-05T10:00:00Z"
  },
  "earningsClaimed": 15,
  "message": "Successfully claimed $25.50. Payout is being processed."
}
```

**Idempotent Response (200) - Already Claimed:**
```json
{
  "success": true,
  "payout": {
    "id": "existing-payout-uuid",
    "amount": 25.50,
    "status": "processing",
    "walletAddress": "...",
    "createdAt": "2026-02-05T10:00:00Z"
  },
  "message": "Payout was already initiated and is being processed."
}
```

**Error Responses:**

| Code | Error | Reason |
|------|-------|--------|
| 400 | Minimum payout amount is $10 | Less than $10 unclaimed |
| 400 | Wallet address not set | User hasn't connected wallet |
| 409 | Another claim is being processed | Concurrent claim detected |

### Transaction Flow

```
Client → API: POST /api/referrals/claim
API → DB: BEGIN TRANSACTION (Serializable)
DB → DB: SELECT * FROM referral_earnings
         WHERE referrer_id = X AND is_paid = false
         FOR UPDATE
         (All unpaid earnings locked)

API: Check for existing pending/processing payout
API: Calculate total from locked earnings
API: Validate minimum $10

API → DB: CREATE payout record (status = pending)
API → DB: UPDATE referral_earnings SET is_paid = true
API → DB: COMMIT

DB → API: Success
API → Client: 200 OK + payout details

--- Async Processing (Cron Job every 15 min) ---

Job → DB: Find pending/failed payouts
Job → Treasury: Transfer USDC
Treasury → Job: Signature + Confirmation
Job → DB: UPDATE payout (status = completed, tx_signature)
```

### Double-Claim Protection

**Lock Query:**
```sql
SELECT * FROM referral_earnings
WHERE referrer_id = ? AND is_paid = false
FOR UPDATE
```

This locks ALL unpaid earnings for the user, preventing concurrent claims.

**Why this is secure:**
1. Row-level locking prevents concurrent transactions from accessing same earnings
2. Serializable isolation ensures transactions execute as if serial
3. Atomic operations mean all-or-nothing (no partial states)
4. Idempotent responses allow safe retries

### Payout Processing

**Architecture:**
- Claim endpoint creates payout record with `status = pending`
- Earnings are marked as `isPaid = true` immediately
- Cron job processes actual USDC transfers asynchronously

**Why async processing?**
- Prevents timeout errors in user requests
- Allows retry logic for failed transfers
- Better treasury balance management
- Clear separation of concerns

**Retry Logic:**
- Max 3 attempts with exponential backoff
- Delays: 0min (immediate), 15min, 60min
- Failed payouts older than 24 hours are skipped
- Admins can monitor via logs

### Automated Payout Processor

**Job:** `apps/jobs/src/jobs/referral-payout-processor.ts`

**Schedule:** Every 15 minutes

**Process:**
1. Find all payouts with `status = pending` or `status = failed`
2. For each payout:
   - Check retry attempt count (max 3)
   - Verify treasury has sufficient funds
   - Execute USDC transfer via Treasury service
   - Update status to `completed` or `failed`
3. Log results for monitoring

**Status Flow:**
```
pending → processing → completed (success)
                    → failed → processing → completed (retry success)
                            → failed (final after 3 attempts)
```

### Testing Double-Claim Prevention

```bash
# Simulate 6 concurrent claim requests
TOKEN="your-auth-token"

for i in {1..6}; do
  curl -X POST http://localhost:3000/api/referrals/claim \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" &
done
wait
```

**Expected Result:**
- 1st request: 200 OK + payout created (status: pending)
- Requests 2-6: Either:
  - 409 CONCURRENT_CLAIM (serialization conflict)
  - 200 OK with existing payout (idempotent response)

**Verify in database:**
```sql
-- Should return exactly 1 row
SELECT * FROM referral_payouts
WHERE user_id = 'test-user-id'
  AND created_at > NOW() - INTERVAL '1 minute';

-- All earnings should be marked as paid
SELECT COUNT(*) FROM referral_earnings
WHERE referrer_id = 'test-user-id'
  AND is_paid = false;
-- Should return 0
```

### Monitoring Queries

**Recent payouts:**
```sql
SELECT
  rp.id,
  rp.user_id,
  rp.amount,
  rp.status,
  rp.tx_signature,
  rp.created_at,
  rp.processed_at
FROM referral_payouts rp
WHERE rp.created_at > NOW() - INTERVAL '7 days'
ORDER BY rp.created_at DESC;
```

**Failed payouts needing admin attention:**
```sql
SELECT
  rp.id,
  rp.user_id,
  rp.amount,
  rp.wallet_address,
  rp.status,
  rp.created_at,
  rp.processed_at,
  EXTRACT(EPOCH FROM (NOW() - rp.created_at)) / 60 AS age_minutes
FROM referral_payouts rp
WHERE rp.status = 'failed'
  AND rp.created_at > NOW() - INTERVAL '24 hours'
ORDER BY rp.created_at DESC;
```

**Payout processing stats (last 24h):**
```sql
SELECT
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM referral_payouts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

## Related Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/prize/claim/route.ts` | Prize claim endpoint |
| `apps/web/src/app/api/referrals/claim/route.ts` | Referral claim endpoint |
| `apps/jobs/src/jobs/referral-payout-processor.ts` | Automated payout processing |
| `apps/web/src/lib/server/treasury.ts` | USDC transfer logic |
| `packages/db/prisma/schema.prisma` | Database schema |
| `apps/jobs/src/jobs/prize-pool-finalize.ts` | Creates prizes with EARNED status |

## Historical Issues

### Issue #1: Double-Claim Bug (Feb 2026)
- **Reporter:** User claimed prize 6 times
- **Root Cause:** Race condition + WebSocket timeout
- **Fix:** Atomic transactions with SELECT FOR UPDATE
- **Status:** RESOLVED

### Issue #2: WebSocket Confirmation Bug
- **Symptom:** UI shows error but transfer succeeded
- **Root Cause:** `sendAndConfirmTransaction()` uses WebSocket which failed in serverless
- **Fix:** Changed to `sendRawTransaction()` + `confirmTransaction()` with polling
- **Status:** RESOLVED
