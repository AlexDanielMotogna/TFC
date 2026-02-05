# Admin Panel - Referral Payout Monitoring & Management Tasks

## Overview
Implementation tasks for admin panel features to monitor and manage referral payouts. The backend processing is already complete (automated payout processor running every 15 min), but the admin UI and API endpoints need to be built.

**Reference:** `docs/Admin-Panel/admin-panel-doc.md` - Section 17

---

## Task 1: Admin API Endpoints ⏳

### 1.1 GET `/api/admin/referrals/payouts`
List all payouts with filters

**Query Parameters:**
- `status` - Filter by: pending, processing, completed, failed
- `dateFrom` / `dateTo` - Date range filter
- `amountMin` / `amountMax` - Amount range filter
- `userId` - Filter by user ID
- `search` - Search by payout ID, wallet address, tx signature
- `page` / `limit` - Pagination (default: 50/page)

**Response:**
```typescript
{
  payouts: Array<{
    id: string;
    userId: string;
    userHandle: string;
    walletAddress: string;
    amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    txSignature: string | null;
    createdAt: Date;
    processedAt: Date | null;
    processingTimeMinutes: number | null;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

**SQL Reference:** See Section 17 - "Recent Payouts" query

---

### 1.2 GET `/api/admin/referrals/payouts/stats`
Get payout statistics

**Response:**
```typescript
{
  allTime: { total: number; totalAmount: number };
  last24h: { total: number; totalAmount: number };
  last7d: { total: number; totalAmount: number };
  pending: { count: number; totalAmount: number };
  failed: { count: number };
  completed24h: { count: number; totalAmount: number };
  avgProcessingTime: number; // minutes
}
```

**SQL References:**
- Section 17 - "Payout Processing Stats (Last 24h)"
- Section 17 - "Pending Payouts (Oldest First)"

---

### 1.3 POST `/api/admin/referrals/payouts/[id]/retry`
Manually retry a failed payout

**Request Body:**
```typescript
{
  payoutId: string;
}
```

**Action:**
Reset payout status to `pending` and clear `processedAt`:
```sql
UPDATE referral_payouts
SET status = 'pending', processed_at = NULL
WHERE id = '<payout-id>';
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  payout: { id: string; status: string; };
}
```

**Notes:**
- Only allow retry for payouts with `status = 'failed'`
- Cron job will pick it up on next cycle (within 15 min)

---

### 1.4 GET `/api/admin/referrals/earnings`
List all referral earnings

**Query Parameters:**
- `userId` - Filter by referrer
- `isPaid` - Filter by payment status
- `dateFrom` / `dateTo` - Date range
- `page` / `limit` - Pagination

**Response:**
```typescript
{
  earnings: Array<{
    id: string;
    referrerId: string;
    referrerHandle: string;
    referredId: string;
    referredHandle: string;
    commissionAmount: number;
    commissionPercent: number;
    isPaid: boolean;
    paidAt: Date | null;
    earnedAt: Date;
  }>;
  pagination: { ... };
}
```

---

## Task 2: Admin UI Page `/admin/referrals/payouts` ⏳

### 2.1 Dashboard Stats Section
Display real-time statistics (fetched from `/api/admin/referrals/payouts/stats`):

**Metrics:**
- Total Payouts (all-time, 24h, 7d)
- Pending Payouts (count + total amount)
- Failed Payouts (count - highlighted in red)
- Completed Payouts 24h (count + total amount)
- Avg Processing Time (minutes)

**Layout:** Grid cards similar to existing admin dashboard

---

### 2.2 Payouts Table
Interactive table showing all payouts

**Columns:**
- Payout ID (truncated, copyable)
- User (handle + truncated wallet)
- Amount (USDC, formatted $X.XX)
- Status (badge with color)
- Created (relative time + full date on hover)
- Processed (relative time or "-")
- Tx Signature (link to Solscan or "-")
- Actions (dropdown menu)

**Status Badges:**
- `pending` - Gray badge "⏳ Pending"
- `processing` - Blue badge "⚙️ Processing"
- `completed` - Green badge "✅ Completed"
- `failed` - Red badge "❌ Failed"

**Filters:**
- Status dropdown (All, Pending, Processing, Completed, Failed)
- Date range picker
- Amount range sliders
- Search input (by ID, wallet, tx signature)

**Pagination:**
- Server-side pagination (50 per page)
- Page navigation controls

---

### 2.3 Expandable Row Details
Click row to expand and show:

**Related Earnings:**
- List of `referral_earnings` that were claimed in this payout
- Show: Referred user, commission amount, earned date

**Retry Attempts History:**
- Estimated retry count (based on age)
- Next retry time (if failed and within retry window)

**Error Messages:**
- Last error message (if failed)
- Treasury balance at time of processing (if logged)

**Processing Logs:**
- Timestamps of status changes
- Any relevant log entries

---

### 2.4 Actions Menu
For each payout row:

**Retry Failed Payout** (only if `status = 'failed'`):
- Button: "🔄 Retry Payout"
- Confirmation dialog
- Calls `POST /api/admin/referrals/payouts/[id]/retry`
- Shows success/error toast

**View Transaction** (only if `txSignature` exists):
- Link: "🔗 View on Solscan"
- Opens `https://solscan.io/tx/{signature}` in new tab

**View User**:
- Link: "👤 View User Profile"
- Navigates to `/admin/users/{userId}`

---

## Task 3: Treasury Balance Monitor Component ⏳

Create reusable component to display treasury status

**Display:**
- USDC Balance (with warning if < $50)
- SOL Balance (with critical alert if < 0.05)
- Available for Claims (on-chain USDC - buffer)
- Last Updated timestamp
- Refresh button

**Data Source:**
- GET `/api/internal/treasury/auto-withdraw`

**Alerts:**
- Yellow warning if USDC < $100
- Red critical if USDC < $50
- Red critical if SOL < 0.05

**Location:**
Use in both:
- `/admin/referrals/payouts` page (top right)
- `/admin/prize-pool` page (existing)

---

## Task 4: Alert System Integration ⏳

### 4.1 Backend: Alert Triggers
Create cron job or webhook to check conditions and send to Discord:

**Discord Webhook Setup:**
- Use Discord webhooks for all notifications
- Create dedicated channels: `#admin-alerts-critical`, `#admin-alerts-daily`, `#admin-alerts-weekly`
- Store webhook URLs in environment variables

**Immediate Alerts (Discord - Critical Channel):**
- Failed payouts > 0 (check after each payout processor run)
  - Message: `🔴 CRITICAL: {count} failed referral payout(s) need attention!`
  - Include: Payout IDs, amounts, error messages
  - Tag: `@admin` role
- Treasury SOL < 0.05
  - Message: `🔴 CRITICAL: Treasury SOL balance critically low: {balance} SOL`
  - Action needed: Send SOL to treasury immediately
- Payout processor not running (no logs for > 30 min)
  - Message: `🔴 CRITICAL: Referral payout processor hasn't run in {minutes} minutes`
  - Check: Server status, cron job health

**Daily Digest (Discord - Daily Channel):**
- Pending payouts > 10
  - Message: `🟡 WARNING: {count} payouts pending (normal: <10)`
  - Include: Oldest pending payout age
- Treasury USDC < $50
  - Message: `🟡 WARNING: Treasury USDC low: ${balance} (minimum: $50)`
  - Action: Fund treasury within 24h

**Weekly Warning (Discord - Weekly Channel):**
- Treasury USDC < $100
  - Message: `⚠️ NOTICE: Treasury USDC below recommended: ${balance} (recommended: >$100)`
  - Action: Plan to fund treasury this week

**Implementation:**
```typescript
// apps/jobs/src/lib/discord-alerts.ts
export async function sendDiscordAlert(
  webhookUrl: string,
  message: {
    title: string;
    description: string;
    color: number; // 0xFF0000 (red), 0xFFFF00 (yellow), 0x00FF00 (green)
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  }
) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: message.title,
        description: message.description,
        color: message.color,
        fields: message.fields,
        timestamp: new Date().toISOString(),
      }],
    }),
  });
}
```

**Environment Variables:**
```bash
DISCORD_WEBHOOK_CRITICAL=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_DAILY=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_WEEKLY=https://discord.com/api/webhooks/...
```

### 4.2 Frontend: Alert Badges
Show alert badges in admin navbar:
- 🔴 Critical (failed payouts, treasury critical)
- 🟡 Warning (pending payouts high, treasury low)

---

## Acceptance Criteria

- [ ] All 4 API endpoints implemented and tested
- [ ] Admin UI page `/admin/referrals/payouts` functional
- [ ] Table shows all payouts with correct status badges
- [ ] Filters work (status, date, amount, search)
- [ ] Pagination works (server-side)
- [ ] Expandable row details show related earnings
- [ ] Retry button resets failed payouts successfully
- [ ] Solscan links open correctly
- [ ] Treasury balance component displays accurate data
- [ ] Alert system triggers notifications correctly
- [ ] Mobile responsive design

---

## Testing Checklist

- [ ] Test with 0 payouts (empty state)
- [ ] Test with 100+ payouts (pagination)
- [ ] Test retry on failed payout (verify cron picks it up)
- [ ] Test filters with various combinations
- [ ] Test search with partial wallet addresses
- [ ] Verify status badges match database status
- [ ] Verify Solscan links are correct (mainnet)
- [ ] Test treasury alerts at threshold values
- [ ] Verify expandable rows show correct earnings

---

## Documentation Updates Needed

After implementation, update:
- `docs/Admin-Panel/admin-panel-doc.md` - Section 17
  - Change all ⏳ status indicators to ✅
  - Add screenshots of implemented UI
  - Document any deviations from original plan

---

## Related Files

**Backend:**
- `apps/jobs/src/jobs/referral-payout-processor.ts` - Payout processor (already done ✅)
- `apps/web/src/app/api/referrals/claim/route.ts` - Claim endpoint (already done ✅)
- `apps/jobs/src/lib/treasury.ts` - Treasury service (already done ✅)

**Database:**
- Prisma schema: `ReferralPayout`, `ReferralEarning` models

**Documentation:**
- `docs/Admin-Panel/admin-panel-doc.md` - Section 17
- `docs/Claim_system/Doc.md` - Security architecture

---

## Implementation Priority

1. **High Priority** (Core functionality):
   - Task 1.1: GET `/api/admin/referrals/payouts` (list payouts)
   - Task 1.2: GET `/api/admin/referrals/payouts/stats` (dashboard stats)
   - Task 2.1: Dashboard Stats Section
   - Task 2.2: Payouts Table (basic version)

2. **Medium Priority** (Admin tools):
   - Task 1.3: POST retry endpoint
   - Task 2.4: Actions Menu (retry, view TX, view user)
   - Task 3: Treasury Balance Monitor Component

3. **Low Priority** (Nice to have):
   - Task 1.4: GET earnings list
   - Task 2.3: Expandable Row Details
   - Task 4: Alert System Integration

---

## Notes for Paul

- Backend payout processing is complete and running ✅
- This task is ONLY for admin monitoring UI
- Use existing SQL queries from Section 17 documentation
- Follow existing admin panel design patterns (see `/admin/users`, `/admin/prize-pool`)
- Ensure proper role-based access control (ADMIN role only)
- Test with real data after implementation
- Can reference referral payout processor logs in `apps/jobs` console
