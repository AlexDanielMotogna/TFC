# Referral System Plan — Trading Fight Club

## Overview

Build a 3-tier referral system that rewards users with trading fee commissions:
- **Tier 1 (Direct)**: 34% from direct referrals
- **Tier 2**: 12% from their referrals
- **Tier 3**: 4% from third-tier referrals

Users earn commissions on ALL trades made through TFC (tracked in `Trade` and `TfcOrderAction` models).

**Scope**: This is a **medium-large feature** (~15-20 hours of development + testing).

---

## 1. Database Schema Changes

### New Models

```prisma
// ─────────────────────────────────────────────────────────────
// REFERRAL SYSTEM
// ─────────────────────────────────────────────────────────────

model Referral {
  id String @id @default(uuid())

  // Who referred whom
  referrerId String @map("referrer_id")
  referrer   User   @relation("Referrals", fields: [referrerId], references: [id], onDelete: Cascade)

  referredId String @map("referred_id")
  referred   User   @relation("ReferredBy", fields: [referredId], references: [id], onDelete: Cascade)

  // Tier level (1, 2, or 3)
  tier Int

  // When the referral was created
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([referrerId, referredId])
  @@index([referrerId, tier])
  @@index([referredId])
  @@map("referrals")
}

model ReferralEarning {
  id String @id @default(uuid())

  // Who earned the commission
  referrerId String @map("referrer_id")

  // Who made the trade
  traderId String @map("trader_id")

  // Which trade generated this earning
  tradeId String @map("trade_id")

  // Tier level (1, 2, or 3)
  tier Int

  // Trade details (snapshot for display)
  symbol     String
  tradeFee   Decimal @map("trade_fee") @db.Decimal(18, 8)      // Original fee from trade
  tradeValue Decimal @map("trade_value") @db.Decimal(18, 8)    // amount * price

  // Commission calculation
  commissionPercent Decimal @map("commission_percent") @db.Decimal(5, 2) // 34.00, 12.00, 4.00
  commissionAmount  Decimal @map("commission_amount") @db.Decimal(18, 8)  // tradeFee * commissionPercent

  // Status
  isPaid Boolean @default(false) @map("is_paid")

  // Timestamps
  earnedAt DateTime @default(now()) @map("earned_at")
  paidAt   DateTime? @map("paid_at")

  @@index([referrerId, isPaid])
  @@index([traderId])
  @@index([earnedAt])
  @@map("referral_earnings")
}

model ReferralPayout {
  id String @id @default(uuid())

  // Who received the payout
  userId String @map("user_id")

  // Amount paid
  amount Decimal @db.Decimal(18, 8)

  // Wallet address where funds were sent
  walletAddress String @map("wallet_address")

  // Transaction details
  txSignature String? @map("tx_signature") // Solana transaction signature

  // Status
  status String @default("pending") // pending, processing, completed, failed

  // Timestamps
  createdAt   DateTime  @default(now()) @map("created_at")
  processedAt DateTime? @map("processed_at")

  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("referral_payouts")
}
```

### Modify Existing Models

Add to `User` model:

```prisma
model User {
  // ... existing fields ...

  // Referral system
  referralCode String  @unique @map("referral_code") // Unique code for sharing
  referredById String? @map("referred_by_id")         // Who referred this user

  // Relations
  referrals      Referral[] @relation("Referrals")      // Users this user referred
  referredBy     Referral[] @relation("ReferredBy")     // Who referred this user
  referralEarnings ReferralEarning[] @relation("ReferralEarnings")

  // ... rest of existing fields ...
}
```

---

## 2. Referral Code Generation

### On User Creation

When a user is created (wallet auth), generate a unique referral code:

```ts
// apps/web/src/lib/server/services/auth.ts → authenticateWallet()

import { generateReferralCode } from '../referral-utils'

// After creating user:
const referralCode = generateReferralCode(user.id)

await prisma.user.update({
  where: { id: user.id },
  data: { referralCode }
})
```

### Referral Code Format

```ts
// apps/web/src/lib/server/referral-utils.ts

export function generateReferralCode(userId: string): string {
  // First 8 chars of SHA256(userId + salt)
  const hash = createHash('sha256')
    .update(userId + process.env.REFERRAL_CODE_SALT)
    .digest('hex')

  return hash.substring(0, 16) // 16 chars, URL-safe
}
```

---

## 3. Referral Registration Flow

### URL Parameter

When a user visits with `?ref=CODE`:
1. Store code in localStorage
2. When user connects wallet → check if referred
3. If not referred yet → create referral chain

```ts
// apps/web/src/lib/hooks/useReferralTracking.ts

export function useReferralTracking() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const refCode = urlParams.get('ref')

    if (refCode) {
      localStorage.setItem('tfc_referral_code', refCode)
    }
  }, [])
}
```

### On Wallet Connection

```ts
// After wallet auth, before returning to client:

const referralCode = localStorage.getItem('tfc_referral_code')

if (referralCode && !user.referredById) {
  await processReferralRegistration(user.id, referralCode)
}
```

### Create Referral Chain

```ts
// apps/web/src/lib/server/services/referral.ts

export async function processReferralRegistration(
  newUserId: string,
  referralCode: string
) {
  // Find referrer
  const referrer = await prisma.user.findUnique({
    where: { referralCode }
  })

  if (!referrer || referrer.id === newUserId) return

  // Create T1 referral
  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: newUserId,
      tier: 1
    }
  })

  // Update user
  await prisma.user.update({
    where: { id: newUserId },
    data: { referredById: referrer.id }
  })

  // Find T2 (referrer's referrer)
  const t1Referral = await prisma.referral.findFirst({
    where: { referredId: referrer.id, tier: 1 }
  })

  if (t1Referral) {
    await prisma.referral.create({
      data: {
        referrerId: t1Referral.referrerId,
        referredId: newUserId,
        tier: 2
      }
    })

    // Find T3 (referrer's referrer's referrer)
    const t2Referral = await prisma.referral.findFirst({
      where: { referredId: t1Referral.referrerId, tier: 1 }
    })

    if (t2Referral) {
      await prisma.referral.create({
        data: {
          referrerId: t2Referral.referrerId,
          referredId: newUserId,
          tier: 3
        }
      })
    }
  }
}
```

---

## 4. Commission Calculation

### Environment Variables

Add to `.env`:

```bash
# Referral commission rates (as percentages, e.g., 34 = 34%)
REFERRAL_COMMISSION_T1=34
REFERRAL_COMMISSION_T2=12
REFERRAL_COMMISSION_T3=4
```

### Commission Configuration Helper

```ts
// apps/web/src/lib/server/referral-config.ts

export function getReferralCommissionRates() {
  return {
    1: parseFloat(process.env.REFERRAL_COMMISSION_T1 || '34') / 100, // 0.34
    2: parseFloat(process.env.REFERRAL_COMMISSION_T2 || '12') / 100, // 0.12
    3: parseFloat(process.env.REFERRAL_COMMISSION_T3 || '4') / 100   // 0.04
  }
}

export function getReferralCommissionRatesDisplay() {
  return {
    t1: parseFloat(process.env.REFERRAL_COMMISSION_T1 || '34'),
    t2: parseFloat(process.env.REFERRAL_COMMISSION_T2 || '12'),
    t3: parseFloat(process.env.REFERRAL_COMMISSION_T3 || '4')
  }
}
```

### On Trade Completion

Every time a trade is recorded in the `Trade` table, calculate referral commissions:

```ts
// apps/web/src/lib/server/services/trade.ts

import { getReferralCommissionRates } from '../referral-config'

export async function recordTradeWithReferrals(tradeData: TradeData) {
  // Create trade (existing logic)
  const trade = await prisma.trade.create({ data: tradeData })

  // Calculate referral commissions
  await calculateReferralCommissions(trade)

  return trade
}

async function calculateReferralCommissions(trade: Trade) {
  // Find all referrers for this trader (T1, T2, T3)
  const referrals = await prisma.referral.findMany({
    where: { referredId: trade.userId }
  })

  // Get commission rates from env vars
  const commissionRates = getReferralCommissionRates()

  for (const referral of referrals) {
    const commissionPercent = commissionRates[referral.tier]
    const commissionAmount = trade.fee.mul(commissionPercent)

    await prisma.referralEarning.create({
      data: {
        referrerId: referral.referrerId,
        traderId: trade.userId,
        tradeId: trade.id,
        tier: referral.tier,
        symbol: trade.symbol,
        tradeFee: trade.fee,
        tradeValue: trade.amount.mul(trade.price),
        commissionPercent: commissionPercent * 100, // Store as percentage (34.00, not 0.34)
        commissionAmount,
        isPaid: false
      }
    })
  }
}
```

---

## 5. API Routes

### GET `/api/referrals/dashboard`

Returns all data for the referrals page:

```ts
{
  referralCode: string
  unclaimedPayout: number

  // Current commission rates (from env vars)
  commissionRates: {
    t1: number  // e.g., 34
    t2: number  // e.g., 12
    t3: number  // e.g., 4
  }

  totalReferrals: {
    t1: number
    t2: number
    t3: number
  }

  totalEarnings: {
    total: number
    t1: number
    t2: number
    t3: number
  }

  referralVolume: {
    total: number
    t1: number
    t2: number
    t3: number
  }

  recentReferrals: Referral[]
  recentEarnings: ReferralEarning[]
  payoutHistory: ReferralPayout[]
}
```

Implementation:

```ts
// apps/web/src/app/api/referrals/dashboard/route.ts

import { getReferralCommissionRatesDisplay } from '@/lib/server/referral-config'

export async function GET(request: Request) {
  const userId = await getCurrentUserId(request)

  // Get commission rates from env
  const commissionRates = getReferralCommissionRatesDisplay()

  // ... rest of queries ...

  return NextResponse.json({
    referralCode: user.referralCode,
    unclaimedPayout,
    commissionRates, // Include rates in response
    totalReferrals,
    totalEarnings,
    referralVolume,
    recentReferrals,
    recentEarnings,
    payoutHistory
  })
}
```

### GET `/api/referrals/list`

Paginated list of referrals with filters:

```ts
{
  referrals: Array<{
    user: { id, handle, walletAddress }
    tier: number
    createdAt: string
    totalTrades: number
    totalVolume: number
    totalEarnings: number
  }>
  totalCount: number
  page: number
  pageSize: number
}
```

### GET `/api/referrals/earnings`

Detailed earnings breakdown:

```ts
{
  earnings: Array<{
    id: string
    trader: { id, handle }
    symbol: string
    tier: number
    commissionAmount: number
    earnedAt: string
    isPaid: boolean
  }>
  totalCount: number
}
```

### POST `/api/referrals/claim`

Claim unclaimed earnings (minimum $10):

```ts
// Request: {}
// Response:
{
  success: boolean
  payoutId: string
  amount: number
  message: string
}
```

---

## 6. UI Implementation

### File Structure

```
apps/web/src/
├── app/referrals/
│   ├── page.tsx                    # Main referrals page
│   └── layout.tsx                  # Wrap with AppShell
├── components/referrals/
│   ├── ReferralDashboard.tsx       # Top stats cards
│   ├── ReferralCodeCard.tsx        # Code display + share
│   ├── UnclaimedPayoutCard.tsx     # Payout card with claim button
│   ├── ReferralsTabs.tsx           # Overview / Referrals / Payouts tabs
│   ├── OverviewTab.tsx             # 3 tables
│   ├── ReferralsTab.tsx            # Referral list table
│   ├── PayoutsTab.tsx              # Payout history table
│   └── ReferralTable.tsx           # Reusable table component
```

### Main Page Layout

```tsx
// apps/web/src/app/referrals/page.tsx

export default function ReferralsPage() {
  const { data } = useQuery({
    queryKey: ['referrals-dashboard'],
    queryFn: () => fetch('/api/referrals/dashboard').then(r => r.json())
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Referral Program</h1>
        <p>
          Earn {data.commissionRates.t1}% from direct referrals,
          {data.commissionRates.t2}% from tier 2,
          {data.commissionRates.t3}% from tier 3
        </p>
      </div>

      {/* Top Row: Code + Payout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReferralCodeCard code={data.referralCode} />
        <UnclaimedPayoutCard amount={data.unclaimedPayout} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Referrals"
          stats={{ t1: data.totalReferrals.t1, t2: ..., t3: ... }}
        />
        <StatsCard
          title="Total Earnings"
          stats={{ total: data.totalEarnings.total, t1: ..., t2: ..., t3: ... }}
        />
        <StatsCard
          title="Referral Trading Volume"
          stats={{ total: data.referralVolume.total, t1: ..., t2: ..., t3: ... }}
          notice="Data may be delayed"
        />
      </div>

      {/* Tabs */}
      <ReferralsTabs
        overview={<OverviewTab data={data} />}
        referrals={<ReferralsTab />}
        payouts={<PayoutsTab />}
      />
    </div>
  )
}
```

### Referral Code Card

```tsx
export function ReferralCodeCard({ code }: { code: string }) {
  const referralUrl = `${window.location.origin}?ref=${code}`

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    toast.success('Referral code copied!')
  }

  const handleShare = () => {
    navigator.clipboard.writeText(referralUrl)
    toast.success('Referral link copied!')
  }

  return (
    <Card>
      <CardHeader>
        <h3>Your Referral Code</h3>
        <p>Share your code and earn from your network's trading activity</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <input value={code} readOnly className="flex-1 font-mono" />
          <Button onClick={handleCopy}>Copy</Button>
          <Button onClick={handleShare}>Share Link</Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Unclaimed Payout Card

```tsx
export function UnclaimedPayoutCard({ amount }: { amount: number }) {
  const canClaim = amount >= 10

  const handleClaim = async () => {
    const res = await fetch('/api/referrals/claim', { method: 'POST' })
    const data = await res.json()

    if (data.success) {
      toast.success('Payout claimed! Processing...')
      queryClient.invalidateQueries(['referrals-dashboard'])
    } else {
      toast.error(data.message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3>Unclaimed Payout</h3>
        <p>Payouts start at $10, wallet can't be edited while claim is pending</p>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold">${amount.toFixed(2)}</div>
        <Button
          onClick={handleClaim}
          disabled={!canClaim}
          className="mt-4"
        >
          {canClaim ? 'Claim' : `Minimum $10 required`}
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## 7. Background Jobs

### Calculate Referral Earnings Job

Run every 5 minutes to process recent trades:

```ts
// apps/jobs/src/jobs/calculate-referral-earnings.ts

export async function calculateReferralEarningsJob() {
  // Find trades from last 10 minutes without earnings
  const recentTrades = await prisma.trade.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      // Not already processed (check if ReferralEarning exists)
    }
  })

  for (const trade of recentTrades) {
    await calculateReferralCommissions(trade)
  }

  console.log(`Processed ${recentTrades.length} trades for referral earnings`)
}
```

---

## 8. Implementation Phases

### Phase 1: Database & Core Logic (4-5 hours)
1. Prisma schema changes (add models + User fields)
2. Run migration
3. Referral code generation on user creation
4. Referral registration flow (URL param → create chain)
5. Commission calculation on trade completion

### Phase 2: API Routes (3-4 hours)
6. GET `/api/referrals/dashboard` with all stats
7. GET `/api/referrals/list` paginated referrals
8. GET `/api/referrals/earnings` detailed earnings
9. POST `/api/referrals/claim` payout claim

### Phase 3: UI Components (5-6 hours)
10. Referral code card with copy/share
11. Unclaimed payout card with claim button
12. Stats cards (Total Referrals, Earnings, Volume)
13. Tabs component (Overview, Referrals, Payouts)
14. Overview tab with 3 tables
15. Referrals tab with paginated table
16. Payouts tab with history table

### Phase 4: Jobs & Testing (3-4 hours)
17. Background job for processing earnings
18. Test referral registration flow
19. Test commission calculations
20. Test payout claiming
21. Test multi-tier referrals (T1 → T2 → T3)

**Total Estimated Time: 15-19 hours**

---

## 9. Admin Panel Integration

### Display Referral Configuration

Add to Admin Panel's System page (`/admin/system`):

```tsx
// apps/web/src/app/admin/system/page.tsx

**Referral Configuration:**
- T1 Commission: {REFERRAL_COMMISSION_T1}%
- T2 Commission: {REFERRAL_COMMISSION_T2}%
- T3 Commission: {REFERRAL_COMMISSION_T3}%
```

### Add to Admin Panel Plan

Update [admin-panel-plan.md](admin-panel-plan.md) Section 3.8 (System):

```markdown
### 3.8 System (`/admin/system`)

**Environment Info:**
- Node env (development/production)
- Vercel env (if available)
- Admin wallets count

**Referral Configuration:**
- T1 Commission: % (configurable via REFERRAL_COMMISSION_T1)
- T2 Commission: % (configurable via REFERRAL_COMMISSION_T2)
- T3 Commission: % (configurable via REFERRAL_COMMISSION_T3)

**Service Health:**
- Database: `SELECT 1` ping with latency
- Realtime server: `GET REALTIME_URL/health` status
- Prisma connection: verify connection pool status
```

### Optional: Referral Stats in Admin Dashboard

Add to Admin Dashboard (`/admin`):

```tsx
**Referral Stats Card:**
- Total Referrals (all users, all tiers)
- Total Referral Earnings (unpaid)
- Pending Payouts (count + total amount)
- Top Referrers (top 5 by earnings)
```

---

## 10. Edge Cases & Considerations

### Self-Referral Prevention
- Check `referrer.id !== newUserId` before creating referral
- Block users from using their own referral code

### Circular Referral Prevention
- User A cannot refer User B if User B is already in User A's referral chain
- Check for circular dependencies before creating referral

### Commission Cap (Optional)
- Consider capping max commission per trade to prevent abuse
- Example: max 50% of trade fee can go to referrals

### Payout Threshold
- Minimum $10 to claim (as shown in UI)
- Prevents small transaction spam

### Wallet Lock During Payout
- User cannot change wallet while payout is "pending" or "processing"
- Prevents payout going to wrong address

### Trade Volume Delay Notice
- Display notice: "Data may be delayed" (as shown in image)
- Earnings are calculated async by background job

---

## 10. Testing Checklist

- [ ] User creates account → referral code generated
- [ ] User visits with `?ref=CODE` → referral chain created (T1)
- [ ] T1 user refers T2 → T2 referral chain created (T1, T2)
- [ ] T2 user refers T3 → T3 referral chain created (T1, T2, T3)
- [ ] T3 user makes trade → all 3 referrers earn commissions (34%, 12%, 4%)
- [ ] Dashboard shows correct stats (referrals, earnings, volume)
- [ ] Referrals tab shows all referred users
- [ ] Earnings tab shows all commissions
- [ ] Payouts tab shows history
- [ ] Claim button disabled when < $10
- [ ] Claim button works when >= $10
- [ ] Self-referral blocked
- [ ] Circular referral blocked

---

## 11. Security Considerations

### Referral Code Uniqueness
- Use `@unique` constraint on `User.referralCode`
- Use cryptographic hash (SHA256) with salt to prevent collisions

### Authorization
- All `/api/referrals/*` routes require authentication
- Users can only view their own referral data
- Admin routes to view all referrals (for admin panel)

### Payout Verification
- Store `txSignature` for audit trail
- Admin approval for payouts > $1000 (optional)
- Rate limit claim endpoint (1 request per minute per user)

---

## 12. Future Enhancements (Post-MVP)

- [ ] Referral leaderboard (top referrers)
- [ ] Bonus rewards for milestones (10 referrals, 100 referrals, etc.)
- [ ] Email notifications when referral signs up or makes first trade
- [ ] Referral analytics dashboard (conversion rates, best performing codes)
- [ ] Custom referral codes (allow users to set vanity codes)
- [ ] Referral campaigns with time-limited bonuses

---

## Summary

This is a **complete referral system** with:
- ✅ 3-tier commission structure (configurable via env vars)
- ✅ Automatic chain creation
- ✅ Real-time commission calculation
- ✅ Payout system with $10 minimum
- ✅ Full UI matching the design
- ✅ Background jobs for processing
- ✅ Admin panel integration

**Complexity:** Medium-Large (~15-19 hours)

**Dependencies:** Prisma, Next.js API routes, React Query, Tailwind

**Priority:** Implement in Phase 2 or 3 after core trading features are stable

---

## Environment Variables Required

Add to `apps/web/.env`:

```bash
# Referral system configuration
REFERRAL_CODE_SALT=your_secret_salt_here
REFERRAL_COMMISSION_T1=34
REFERRAL_COMMISSION_T2=12
REFERRAL_COMMISSION_T3=4
```

Add to `apps/web/.env.example`:

```bash
# Referral system
REFERRAL_CODE_SALT=
REFERRAL_COMMISSION_T1=34
REFERRAL_COMMISSION_T2=12
REFERRAL_COMMISSION_T3=4
```

### Changing Commission Rates in Production

**On Vercel:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Update `REFERRAL_COMMISSION_T1`, `REFERRAL_COMMISSION_T2`, `REFERRAL_COMMISSION_T3`
3. Redeploy the application (or wait for auto-redeploy)
4. Changes take effect immediately after deployment

**Important Notes:**
- Existing `ReferralEarning` records keep their original `commissionPercent` (snapshot)
- Only NEW trades will use the updated commission rates
- No database migration needed - rates are runtime configuration
- Consider announcing rate changes to users in advance
