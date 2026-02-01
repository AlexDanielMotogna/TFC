# Admin Panel Plan — Trading Fight Club

## Overview

Build a developer/admin panel inside the existing `apps/web` Next.js app at `/admin/*` routes. Uses the existing tech stack (Tailwind dark theme, Prisma, Zustand, React Query). No new apps or heavy frameworks.

---

## 1. Architecture Decision

**Location:** Route group inside `apps/web/src/app/admin/`

- Two admin API routes already exist at `apps/web/src/app/api/admin/` — extend this pattern
- Next.js API routes already have direct Prisma access via `lib/server/db.ts`
- Reuses the same Tailwind config, design tokens (`surface-*`, `primary-*`), and component patterns
- No separate deployment or Turborepo workspace needed

### File Structure

```
apps/web/src/
├── app/admin/
│   ├── layout.tsx              # Admin shell (sidebar + topbar, separate from AppShell)
│   ├── page.tsx                # Dashboard
│   ├── users/
│   │   ├── page.tsx            # User list/search
│   │   └── [id]/page.tsx       # User detail
│   ├── fights/
│   │   ├── page.tsx            # Fight list/monitor
│   │   └── [id]/page.tsx       # Fight detail/inspect
│   ├── trades/page.tsx         # Trade analytics
│   ├── leaderboard/page.tsx    # Leaderboard management
│   ├── prize-pool/page.tsx     # Prize pool management
│   ├── jobs/page.tsx           # Background jobs monitor
│   ├── system/page.tsx         # Service health
│   └── referrals/page.tsx      # Referral management (optional)
├── app/api/admin/
│   ├── stats/route.ts
│   ├── users/route.ts
│   ├── users/[id]/route.ts
│   ├── fights/route.ts
│   ├── fights/[id]/route.ts
│   ├── fights/[id]/cancel/route.ts
│   ├── fights/[id]/finish/route.ts
│   ├── trades/route.ts
│   ├── leaderboard/refresh/route.ts
│   ├── prize-pool/route.ts
│   ├── prize-pool/distribute/route.ts  # (already exists, upgrade auth)
│   ├── prize-pool/finalize/route.ts
│   ├── jobs/status/route.ts
│   ├── system/health/route.ts
│   ├── referrals/route.ts
│   └── referrals/stats/route.ts
├── components/admin/
│   ├── AdminLayout.tsx         # Sidebar + topbar shell
│   ├── AdminSidebar.tsx        # Nav sidebar
│   ├── AdminTable.tsx          # Sortable, paginated table
│   ├── AdminCard.tsx           # Stat card (value + label + trend)
│   ├── AdminBadge.tsx          # Status badges (LIVE, WAITING, etc.)
│   ├── AdminSearch.tsx         # Search input with debounce
│   └── AdminModal.tsx          # Confirmation modal for destructive actions
└── lib/
    └── server/
        └── admin-auth.ts       # withAdminAuth middleware
```

---

## 2. Admin Authentication

### Schema Change

Add `UserRole` enum and `role` field to User in `packages/db/prisma/schema.prisma`:

```prisma
enum UserRole {
  USER
  ADMIN
}

model User {
  // ... existing fields ...
  role UserRole @default(USER)
}
```

### Auth Flow

1. **Env var** `ADMIN_WALLET_ADDRESSES` — comma-separated wallet addresses that are admins
2. **On wallet auth** (`lib/server/services/auth.ts` → `authenticateWallet`): after finding/creating user, check if `walletAddress` is in `ADMIN_WALLET_ADDRESSES` → set `role: ADMIN`
3. **JWT payload** — add `role` field to `JwtPayload` in `lib/server/auth.ts`:
   ```ts
   export interface JwtPayload {
     sub: string;
     walletAddress: string;
     role: 'USER' | 'ADMIN';
   }
   ```
4. **New middleware** `lib/server/admin-auth.ts`:
   ```ts
   export async function withAdminAuth(request, handler) → verifies JWT + checks role === 'ADMIN'
   ```
5. **Client-side** — admin layout reads `role` from auth store, redirects to `/` if not admin
6. **Fallback** — keep existing `ADMIN_SECRET` env var for script/curl-based access

### Files to Modify
- `packages/db/prisma/schema.prisma` — add enum + field
- `apps/web/src/lib/server/auth.ts` — add `role` to `JwtPayload` and `generateToken`
- `apps/web/src/lib/server/services/auth.ts` — check admin wallets, set role on user, include role in JWT
- `apps/web/src/lib/store.ts` — add `role` to auth store user object

---

## 3. Admin Pages — Details

### 3.1 Dashboard (`/admin`)

**Stats cards:**
| Card | Query |
|------|-------|
| Total Users | `prisma.user.count()` |
| Active Users (7d) | `COUNT(DISTINCT user_id) FROM trades WHERE created_at > now() - 7d` |
| Pacifica Connected | `prisma.pacificaConnection.count({ isActive: true })` |
| Trading Volume (24h / all) | `SUM(amount * price) FROM trades` |
| Total Fees | `SUM(fee) FROM trades` |
| Fights by Status | `prisma.fight.groupBy({ by: ['status'] })` |

**Prize pool summary:** Current week's pool amount + top 3 winners

**Recent activity:** List of recent fights (last 10) with status and basic info

---

### 3.2 User Management (`/admin/users`, `/admin/users/[id]`)

**List page:**
- Search by handle, wallet address, user ID
- Filters: has Pacifica, role, date range
- Columns: Handle, Wallet (truncated), Pacifica, Fights, Total PnL, Created, Role
- Pagination: server-side, 25/page

**Detail page:**
- All User fields + Pacifica connection info
- Fight history (all fights with results)
- Recent trades (paginated, last 50)
- Leaderboard rank (weekly + all-time)
- Trade stats: total trades, success rate, total volume
- Actions: promote/demote admin role

---

### 3.3 Fight Management (`/admin/fights`, `/admin/fights/[id]`)

**List page:**
- Filters: status, date range, stake, duration
- Columns: ID, Status (badge), Creator, Opponent, Stake, Duration, Started, Time Remaining / Result, Winner
- Quick actions: force cancel, force finish
- **Suspicious activity tab:** Fights flagged with rule violations

**Suspicious Activity Detection (fight-specific):**
- Fights with `externalTradesDetected = true` (violates fight rules)
- Participants with external trades during any fight (table: user, total fights, fights with violations)
- Fights with unusual PnL patterns (future: ML-based detection)

**Detail page:**
- Full Fight data + both participants with scores
- FightSnapshot entries (table with timestamp, creator PnL, opponent PnL)
- All FightTrade entries for both participants (grouped by participant)
- **External trades warning** (if `externalTradesDetected = true`) - highlight in red with details
- Raw fight data (formatted JSON in `<pre>` tag)
- Admin actions: force cancel, force finish

**New API endpoints:**
- `POST /api/admin/fights/[id]/cancel` — sets status CANCELLED, notifies realtime
- `POST /api/admin/fights/[id]/finish` — triggers reconciliation logic, notifies realtime

---

### 3.4 Trade Analytics (`/admin/trades`)

**Metrics:**
- Total volume (all-time, 24h, 7d)
- Total fees (all-time, 24h, 7d)
- Total trades count
- Top traded symbols (table: symbol, count, volume)

**Trade log:** Paginated list filterable by user, symbol, date, fight

---

### 3.5 Leaderboard Management (`/admin/leaderboard`)

- Weekly + all-time leaderboards side by side
- Last refresh timestamp (from `calculatedAt`)
- "Refresh Now" button → `POST /api/admin/leaderboard/refresh`
- Top winner validation/audit info

---

### 3.6 Prize Pool Management (`/admin/prize-pool`)

- Current week: live pool amount, projected top 3, time remaining
- History: all weeks with finalization + distribution status
- Expandable rows showing WeeklyPrize entries per week
- Actions:
  - "Distribute" button (upgrade existing route with proper admin auth)
  - "Force Finalize" button → calls finalize logic
- Upgrade existing `POST /api/admin/prize-pool/distribute` from `ADMIN_SECRET` to `withAdminAuth`

---

### 3.7 Jobs Monitor (`/admin/jobs`)

Monitor job health by checking data freshness (no direct job execution):

| Job | Schedule | Health Check |
|-----|----------|-------------|
| Leaderboard Refresh | 5 min | `MAX(calculated_at)` from leaderboard_snapshots < 10min ago |
| Cleanup Stale Fights | 1 min | No WAITING fights older than 15 min |
| Fight Reconciliation | 1 min | No LIVE fights past endedAt |
| Prize Pool Finalize | Weekly | Last completed week's pool `isFinalized` |
| Prize Pool Update | 5 min | Current week's pool `updated_at` < 10min ago |

**Status badges:**
- Green (healthy): data within expected interval
- Yellow (stale): data 2x+ expected interval
- Red (failed): data 3x+ expected interval

Display last check time and refresh status every 30s

---

### 3.8 System (`/admin/system`)

**Environment Info:**
- Node env (development/production)
- Vercel env (if available)
- Admin wallets count

**Service Health:**
- Database: `SELECT 1` ping with latency
- Realtime server: `GET REALTIME_URL/health` status
- Prisma connection: verify connection pool status

**Referral Configuration:**
- Commission rates (T1/T2/T3)
- Referral system status (enabled/disabled)
- Minimum payout threshold

---

### 3.9 Referral Stats (Dashboard Integration)

**Stats cards (add to Dashboard):**
| Card | Query |
|------|-------|
| Total Referrals | `prisma.referral.count()` |
| Unpaid Earnings | `SUM(earnings) WHERE status = 'PENDING'` |
| Pending Payouts | `COUNT(*) FROM referral_payouts WHERE status = 'PENDING'` |

**Optional: Referral Management Page (`/admin/referrals`)**
- List all referrers with referral count and total earnings
- View referral tree (T1/T2/T3)
- Process payouts manually
- Export referral data

---

## 4. Admin UI Components

### AdminLayout
- **Sidebar** (left, collapsible): Dashboard, Users, Fights, Trades, Leaderboard, Prize Pool, Jobs, System
- **Top bar**: "TFC Admin" branding, environment badge (dev/staging/prod), current user, "Back to Site" link
- **Content area**: right side, full height

### Design
- Same dark theme from existing `tailwind.config.ts`
- `bg-surface-900` background, `bg-surface-850` cards, `border-surface-700` borders
- Status badges: green for active/live, amber for waiting, red for cancelled, blue for finished
- Font: Inter (sans), Roboto Mono (data/numbers)

---

## 5. Implementation Phases

### Phase 1: Foundation
1. Prisma schema migration (add `UserRole` enum + `role` field)
2. `withAdminAuth` middleware
3. Update JWT to include role
4. Update auth flow to check admin wallets + set role
5. Admin layout + sidebar components
6. Dashboard page with stats cards

### Phase 2: Core Operations
7. User list + detail pages (with API routes)
8. Fight list + detail pages (with API routes)
9. Force cancel/finish fight endpoints
10. Prize pool management page (upgrade existing route)

### Phase 3: Analytics & Monitoring
11. Trade analytics page
12. Jobs monitoring page (health checks only)
13. System page (service health)
14. Leaderboard management + manual refresh

### Phase 4: Polish
15. Error handling, loading states
16. Responsive layout tweaks
17. Performance optimization

### Phase 5: Referral System Integration
18. Add referral configuration display to `/admin/system`
19. Show T1/T2/T3 commission rates
20. Show referral system status (enabled/disabled)
21. Add referral stats card to admin dashboard (total referrals, unpaid earnings, pending payouts)

---

## 6. New API Endpoints Summary

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/stats` | Dashboard aggregated stats |
| GET | `/api/admin/users` | List/search users |
| GET | `/api/admin/users/[id]` | User detail with relations |
| PATCH | `/api/admin/users/[id]` | Update user role |
| GET | `/api/admin/fights` | List/filter fights |
| GET | `/api/admin/fights/[id]` | Fight detail with trades + snapshots |
| POST | `/api/admin/fights/[id]/cancel` | Force cancel |
| POST | `/api/admin/fights/[id]/finish` | Force finish |
| GET | `/api/admin/trades` | Trade list + analytics |
| POST | `/api/admin/leaderboard/refresh` | Manual refresh |
| GET | `/api/admin/prize-pool` | All prize pools |
| POST | `/api/admin/prize-pool/distribute` | (exists — upgrade auth) |
| POST | `/api/admin/prize-pool/finalize` | Force finalize |
| GET | `/api/admin/jobs/status` | Job health checks |
| GET | `/api/admin/system/health` | Service health status |
| GET | `/api/admin/referrals` | List referrers with stats |
| GET | `/api/admin/referrals/stats` | Referral system stats |
| POST | `/api/admin/referrals/payout` | Process referral payout |

All protected with `withAdminAuth`.


## 7. Beta Access Management (`/admin/beta`)

### Current State
The `BetaWhitelist` model already exists with a `status` field (pending/approved/rejected).

### Schema (Already Exists)
```prisma
model BetaWhitelist {
  id            String    @id @default(uuid())
  walletAddress String    @unique @map("wallet_address")
  status        String    @default("pending") // pending, approved, rejected
  appliedAt     DateTime  @default(now()) @map("applied_at")
  approvedAt    DateTime? @map("approved_at")

  @@map("beta_whitelist")
}
```

### Admin Page Features
- List all beta applications with status badges (pending/approved/rejected)
- Search by wallet address
- Filter by status
- Bulk approve/reject actions
- Single-click approve/reject buttons per row

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/beta` | List all beta applications with pagination |
| PATCH | `/api/admin/beta/[wallet]` | Update beta status (approve/reject) |
| POST | `/api/admin/beta/bulk` | Bulk approve/reject multiple applications |

### PATCH `/api/admin/beta/[wallet]` Request
```typescript
{
  status: 'approved' | 'rejected'
}
```

### Response
```typescript
{
  success: boolean,
  walletAddress: string,
  status: string,
  approvedAt?: string  // ISO date if approved
}
```

---

## 8. User Account Management (Ban/Delete)

### Schema Change Required

Add `UserStatus` enum and status fields to User model in `packages/db/prisma/schema.prisma`:

```prisma
enum UserStatus {
  ACTIVE
  BANNED
  DELETED
}

model User {
  // ... existing fields ...
  status       UserStatus @default(ACTIVE)
  bannedAt     DateTime?  @map("banned_at")
  bannedReason String?    @map("banned_reason")
  deletedAt    DateTime?  @map("deleted_at")
}
```

### User Management Actions

#### Ban User
- Sets `status: BANNED`
- Records `bannedAt` timestamp and optional `bannedReason`
- User cannot log in or perform any actions while banned
- All active fights are cancelled
- User is removed from leaderboards

#### Unban User
- Sets `status: ACTIVE`
- Clears `bannedAt` and `bannedReason`
- User can resume normal activity

#### Delete User (Soft Delete)
- Sets `status: DELETED` and `deletedAt` timestamp
- Preserves data for audit trail
- User cannot log in
- Handle becomes available after 30 days (optional)
- Consider GDPR: provide hard delete option for EU users

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/admin/users/[id]/ban` | Ban a user |
| POST | `/api/admin/users/[id]/unban` | Unban a user |
| DELETE | `/api/admin/users/[id]` | Soft delete user account |
| DELETE | `/api/admin/users/[id]?hard=true` | Hard delete (GDPR) |

### POST `/api/admin/users/[id]/ban` Request
```typescript
{
  reason?: string  // Optional ban reason for audit
}
```

### Response
```typescript
{
  success: boolean,
  userId: string,
  status: 'BANNED',
  bannedAt: string,
  bannedReason?: string,
  cancelledFights: number  // Count of fights cancelled due to ban
}
```

### UI Implementation
- Add "Ban" and "Delete" buttons to user detail page
- Confirmation modal for destructive actions
- Show ban reason input field
- Display ban status badge on user list/detail
- Show deleted users in separate tab (hidden by default)

---

## 9. Fight Manual Resolution

### Current State
Fights are resolved automatically by the realtime engine (`apps/realtime/src/fight-engine.ts`). However, some fights may fail to resolve due to:
- Realtime server downtime
- Network issues during resolution
- Anti-cheat API failures
- Edge cases in PnL calculation

### Manual Resolution Endpoint

Allows admin to manually resolve a fight that failed automatic resolution.

### API Endpoint

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/admin/fights/[id]/resolve` | Manually resolve a failed fight |

### POST `/api/admin/fights/[id]/resolve` Request
```typescript
{
  status: 'FINISHED' | 'NO_CONTEST' | 'CANCELLED',
  winnerId?: string | null,  // null for draw or NO_CONTEST
  isDraw?: boolean,          // true for draw result
  reason?: string            // Admin note for audit trail
}
```

### Resolution Logic

1. **Validate fight exists and is in LIVE status** (or stuck state)
2. **If status = FINISHED:**
   - Require `winnerId` OR `isDraw: true`
   - Update `FightParticipant` records with final scores
   - Set `endedAt` to current timestamp
3. **If status = NO_CONTEST:**
   - Fight excluded from rankings
   - No winner determined
   - Create `AntiCheatViolation` record with admin reason
4. **If status = CANCELLED:**
   - Fight completely cancelled
   - No impact on rankings or stats
5. **Broadcast via WebSocket:**
   - Emit `FIGHT_FINISHED` or `FIGHT_CANCELLED` event
   - Update arena subscribers
6. **Create audit log entry** with admin userId and reason

### Response
```typescript
{
  success: boolean,
  fightId: string,
  previousStatus: string,
  newStatus: string,
  winnerId?: string,
  isDraw: boolean,
  resolvedBy: string,  // Admin userId
  resolvedAt: string   // ISO timestamp
}
```

### UI Implementation
- Add "Resolve" button to fight detail page (only for LIVE fights past `endedAt`)
- Modal with options:
  - Select winner from participants dropdown
  - Mark as draw checkbox
  - Mark as NO_CONTEST option
  - Cancel fight option
  - Reason text field (required)
- Show resolution history/audit trail on fight detail

### Stuck Fight Detection
Add to Jobs Monitor page:
- Count of LIVE fights past `endedAt + 5 minutes`
- Alert badge when stuck fights exist
- Quick link to fight list filtered by stuck status

---

## 10. Updated File Structure

```
apps/web/src/
├── app/admin/
│   ├── layout.tsx
│   ├── page.tsx                # Dashboard
│   ├── beta/
│   │   └── page.tsx            # Beta access management (NEW)
│   ├── users/
│   │   ├── page.tsx            # User list with ban/delete actions
│   │   └── [id]/page.tsx       # User detail with actions
│   ├── fights/
│   │   ├── page.tsx            # Fight list with resolve action
│   │   └── [id]/page.tsx       # Fight detail with resolve modal
│   ├── trades/page.tsx
│   ├── leaderboard/page.tsx
│   ├── prize-pool/page.tsx
│   ├── jobs/page.tsx
│   ├── system/page.tsx
│   └── referrals/page.tsx
├── app/api/admin/
│   ├── stats/route.ts
│   ├── beta/
│   │   ├── route.ts            # GET list, POST bulk (NEW)
│   │   └── [wallet]/route.ts   # PATCH status (NEW)
│   ├── users/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── ban/route.ts    # POST ban (NEW)
│   │       └── unban/route.ts  # POST unban (NEW)
│   ├── fights/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── cancel/route.ts
│   │       ├── finish/route.ts
│   │       └── resolve/route.ts  # POST resolve (NEW)
│   ├── trades/route.ts
│   ├── leaderboard/refresh/route.ts
│   ├── prize-pool/
│   │   ├── route.ts
│   │   ├── distribute/route.ts
│   │   └── finalize/route.ts
│   ├── jobs/status/route.ts
│   ├── system/health/route.ts
│   ├── referrals/
│   │   ├── route.ts
│   │   ├── stats/route.ts
│   │   └── payout/route.ts
│   └── ...
```

---

## 11. Updated API Endpoints Summary

| Method | Route | Purpose | Priority |
|--------|-------|---------|----------|
| GET | `/api/admin/stats` | Dashboard aggregated stats | Medium |
| GET | `/api/admin/beta` | List beta applications | **High** |
| PATCH | `/api/admin/beta/[wallet]` | Approve/reject beta | **High** |
| POST | `/api/admin/beta/bulk` | Bulk approve/reject | Medium |
| GET | `/api/admin/users` | List/search users | Medium |
| GET | `/api/admin/users/[id]` | User detail with relations | Medium |
| PATCH | `/api/admin/users/[id]` | Update user role | Medium |
| POST | `/api/admin/users/[id]/ban` | Ban user | **High** |
| POST | `/api/admin/users/[id]/unban` | Unban user | **High** |
| DELETE | `/api/admin/users/[id]` | Delete user account | **High** |
| GET | `/api/admin/fights` | List/filter fights | Medium |
| GET | `/api/admin/fights/[id]` | Fight detail with trades | Medium |
| POST | `/api/admin/fights/[id]/cancel` | Force cancel | Medium |
| POST | `/api/admin/fights/[id]/finish` | Force finish | Medium |
| POST | `/api/admin/fights/[id]/resolve` | Manual resolution | **High** |
| GET | `/api/admin/trades` | Trade list + analytics | Low |
| POST | `/api/admin/leaderboard/refresh` | Manual refresh | Low |
| GET | `/api/admin/prize-pool` | All prize pools | Low |
| POST | `/api/admin/prize-pool/distribute` | Distribute prizes | Low |
| POST | `/api/admin/prize-pool/finalize` | Force finalize | Low |
| GET | `/api/admin/jobs/status` | Job health checks | Low |
| GET | `/api/admin/system/health` | Service health status | Low |
| GET | `/api/admin/referrals` | List referrers | Low |
| GET | `/api/admin/referrals/stats` | Referral stats | Low |
| POST | `/api/admin/referrals/payout` | Process payout | Low |

All protected with `withAdminAuth`.

---

## 12. Implementation Priority

### Phase 0: Schema Changes (Required First)
1. Add `UserStatus` enum to Prisma schema
2. Add `status`, `bannedAt`, `bannedReason`, `deletedAt` fields to User model
3. Run migration: `npx prisma migrate dev --name add_user_status`

### Phase 1: High Priority Admin Actions
1. Beta access management page + API endpoints
2. User ban/unban endpoints
3. User delete endpoint
4. Fight manual resolve endpoint
5. Add action buttons to existing admin pages

### Phase 2: Core Pages (Original Plan)
6. Complete user list/detail pages
7. Complete fight list/detail pages
8. Prize pool management

### Phase 3: Analytics & Monitoring
9. Trade analytics
10. Jobs monitor
11. System health
12. Leaderboard management

---

## 13. Verification

- Run `npx prisma migrate dev` after schema change — verify migration succeeds
- Test admin auth: connect with admin wallet → verify JWT contains `role: 'ADMIN'`
- Test admin auth: connect with non-admin wallet → verify `/admin` redirects to `/`
- Test each admin page loads and shows correct data
- Test beta approve/reject functionality
- Test user ban/unban/delete functionality
- Test fight manual resolution
- Test force cancel/finish on a fight
- Test leaderboard manual refresh
- Test prize pool finalize/distribute
- Verify job health checks display correctly
- Verify existing user-facing functionality is unaffected
- Verify banned users cannot access the platform
