# Referral System - Development Checklist

## Phase 1: Database & Core Logic ⏳

### 1.1 Prisma Schema Changes
- [x] Add `Referral` model to schema
- [x] Add `ReferralEarning` model to schema
- [x] Add `ReferralPayout` model to schema
- [x] Add `referralCode` field to User model (nullable for now)
- [x] Add `referredById` field to User model
- [x] Add relations to User model (referrals, referredBy, referralEarnings)
- [x] Run `npx prisma db push` (used instead of migrate for dev)
- [x] Verify migration succeeded
- [x] Generate Prisma client

### 1.2 Environment Variables
- [x] Add `REFERRAL_CODE_SALT` to `.env`
- [x] Add `REFERRAL_COMMISSION_T1` to `.env`
- [x] Add `REFERRAL_COMMISSION_T2` to `.env`
- [x] Add `REFERRAL_COMMISSION_T3` to `.env`
- [ ] Update `.env.example` with referral variables

### 1.3 Referral Configuration Helper
- [x] Create `apps/web/src/lib/server/referral-config.ts`
- [x] Implement `getReferralCommissionRates()` function
- [x] Implement `getReferralCommissionRatesDisplay()` function

### 1.4 Referral Code Generation
- [x] Create `apps/web/src/lib/server/referral-utils.ts`
- [x] Implement `generateReferralCode(userId)` function
- [x] Update `authenticateWallet()` in auth service to generate referral code on user creation
- [x] Update `getOrCreateUser()` in auth service to generate referral code

### 1.5 Referral Registration Flow
- [x] Create `apps/web/src/lib/server/services/referral.ts`
- [x] Implement `processReferralRegistration()` function (creates T1/T2/T3 chain)
- [x] Add self-referral prevention check
- [x] Add circular referral prevention check (prevents changing referrer)
- [x] Create `apps/web/src/lib/hooks/useReferralTracking.ts`
- [x] Implement URL param capture (`?ref=CODE`)
- [x] Integrate with wallet connection flow (`authenticateWallet` now accepts `referralCode`)

### 1.6 Commission Calculation
- [x] Create `calculateReferralCommissions()` function in referral service
- [x] Update `recordAllTrades()` in orders API to call commission calculation
- [x] Integrate with trade recording flow (non-blocking)
- [ ] Test commission calculation with T1/T2/T3 referrals (Phase 4)

---

## Phase 2: API Routes ⏳

### 2.1 Dashboard API
- [ ] Create `apps/web/src/app/api/referrals/dashboard/route.ts`
- [ ] Implement GET handler with authentication
- [ ] Query total referrals (T1, T2, T3)
- [ ] Query total earnings (total, T1, T2, T3)
- [ ] Query referral volume (total, T1, T2, T3)
- [ ] Query unclaimed payout amount
- [ ] Query recent referrals (last 10)
- [ ] Query recent earnings (last 20)
- [ ] Query payout history
- [ ] Include commission rates in response
- [ ] Test endpoint with Postman/Thunder Client

### 2.2 Referrals List API
- [ ] Create `apps/web/src/app/api/referrals/list/route.ts`
- [ ] Implement pagination
- [ ] Implement tier filter
- [ ] Implement search by handle
- [ ] Calculate trade stats per referral
- [ ] Test endpoint

### 2.3 Earnings API
- [ ] Create `apps/web/src/app/api/referrals/earnings/route.ts`
- [ ] Implement pagination
- [ ] Implement filters (tier, isPaid, date range)
- [ ] Test endpoint

### 2.4 Claim Payout API
- [ ] Create `apps/web/src/app/api/referrals/claim/route.ts`
- [ ] Implement POST handler
- [ ] Check minimum $10 threshold
- [ ] Check wallet is set
- [ ] Create ReferralPayout record
- [ ] Mark earnings as paid
- [ ] Add rate limiting (1 req/min per user)
- [ ] Test claim flow

---

## Phase 3: UI Components ⏳

### 3.1 Page Setup
- [ ] Create `apps/web/src/app/referrals/page.tsx`
- [ ] Create `apps/web/src/app/referrals/layout.tsx`
- [ ] Setup React Query for dashboard data

### 3.2 Referral Code Card
- [ ] Create `apps/web/src/components/referrals/ReferralCodeCard.tsx`
- [ ] Display referral code
- [ ] Implement copy button
- [ ] Implement share link button
- [ ] Add toast notifications

### 3.3 Unclaimed Payout Card
- [ ] Create `apps/web/src/components/referrals/UnclaimedPayoutCard.tsx`
- [ ] Display unclaimed amount
- [ ] Implement claim button
- [ ] Disable button if < $10
- [ ] Show pending status during claim

### 3.4 Stats Cards
- [ ] Create `apps/web/src/components/referrals/StatsCard.tsx`
- [ ] Total Referrals card (T1/T2/T3 breakdown)
- [ ] Total Earnings card (total + T1/T2/T3)
- [ ] Referral Volume card (total + T1/T2/T3 + notice)

### 3.5 Tabs Component
- [ ] Create `apps/web/src/components/referrals/ReferralsTabs.tsx`
- [ ] Setup Overview, Referrals, Payouts tabs
- [ ] Tab navigation

### 3.6 Overview Tab
- [ ] Create `apps/web/src/components/referrals/OverviewTab.tsx`
- [ ] Referrals table (recent 10)
- [ ] Referral Trading Volume table
- [ ] Total Earnings table
- [ ] "No Data Yet" empty states

### 3.7 Referrals Tab
- [ ] Create `apps/web/src/components/referrals/ReferralsTab.tsx`
- [ ] Create `apps/web/src/components/referrals/ReferralsTable.tsx`
- [ ] Implement pagination
- [ ] Implement tier filter
- [ ] Implement search
- [ ] Display: handle, tier, joined date, trades, volume, earnings

### 3.8 Payouts Tab
- [ ] Create `apps/web/src/components/referrals/PayoutsTab.tsx`
- [ ] Create `apps/web/src/components/referrals/PayoutsTable.tsx`
- [ ] Display: date, amount, status, tx signature
- [ ] Implement pagination

### 3.9 Main Page Integration
- [ ] Integrate all components in `referrals/page.tsx`
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test responsive layout

---

## Phase 4: Background Jobs & Testing ⏳

### 4.1 Background Job
- [ ] Create `apps/jobs/src/jobs/calculate-referral-earnings.ts`
- [ ] Implement job to process recent trades
- [ ] Add job to scheduler
- [ ] Test job execution

### 4.2 Testing - Referral Registration
- [ ] Test: User creates account → referral code generated
- [ ] Test: Visit with `?ref=CODE` → localStorage stores code
- [ ] Test: Connect wallet → T1 referral created
- [ ] Test: T1 refers T2 → T2 chain created (T1, T2)
- [ ] Test: T2 refers T3 → T3 chain created (T1, T2, T3)
- [ ] Test: Self-referral blocked
- [ ] Test: Circular referral blocked

### 4.3 Testing - Commissions
- [ ] Test: T3 user makes trade → all 3 referrers earn commissions
- [ ] Test: Commission percentages correct (34%, 12%, 4%)
- [ ] Test: Commission amounts calculated correctly
- [ ] Test: Earnings stored in database

### 4.4 Testing - API Endpoints
- [ ] Test: Dashboard returns correct stats
- [ ] Test: Referrals list pagination works
- [ ] Test: Earnings list with filters
- [ ] Test: Claim button disabled when < $10
- [ ] Test: Claim creates payout record

### 4.5 Testing - UI
- [ ] Test: Referral code copy works
- [ ] Test: Share link copy works
- [ ] Test: Stats cards display correctly
- [ ] Test: Tabs navigation
- [ ] Test: Tables display data
- [ ] Test: Pagination works
- [ ] Test: Empty states show
- [ ] Test: Loading states
- [ ] Test: Error handling

---

## Phase 5: Admin Panel Integration ⏳

### 5.1 System Page
- [ ] Add referral configuration display to `/admin/system`
- [ ] Show T1/T2/T3 commission rates
- [ ] Show referral system status (enabled/disabled)

### 5.2 Dashboard Stats (Optional)
- [ ] Add referral stats card to admin dashboard
- [ ] Total referrals count
- [ ] Total unpaid earnings
- [ ] Pending payouts count

---

## Phase 6: Final Polish ⏳

### 6.1 Documentation
- [ ] Update README with referral system info
- [ ] Document env vars in .env.example
- [ ] Add code comments

### 6.2 Performance
- [ ] Add database indexes for referral queries
- [ ] Optimize dashboard queries
- [ ] Test with large datasets

### 6.3 Security
- [ ] Review authorization on all endpoints
- [ ] Test rate limiting on claim endpoint
- [ ] Verify wallet lock during payout

### 6.4 Final Testing
- [ ] End-to-end test full referral flow
- [ ] Test on staging environment
- [ ] Test commission rate changes
- [ ] Verify no regressions in existing features

---

## Deployment Checklist 🚀

- [ ] Merge to main branch
- [ ] Set env vars on Vercel:
  - [ ] REFERRAL_CODE_SALT
  - [ ] REFERRAL_COMMISSION_T1
  - [ ] REFERRAL_COMMISSION_T2
  - [ ] REFERRAL_COMMISSION_T3
- [ ] Deploy to production
- [ ] Run migration on production DB
- [ ] Verify referral system works in production
- [ ] Monitor for errors in first 24h

---

## Progress Summary

**Phase 1:** ⬜ 0/6 sections
**Phase 2:** ⬜ 0/4 sections
**Phase 3:** ⬜ 0/9 sections
**Phase 4:** ⬜ 0/5 sections
**Phase 5:** ⬜ 0/2 sections
**Phase 6:** ⬜ 0/4 sections

**Overall:** 0% complete
