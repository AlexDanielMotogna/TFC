# Referral System - Manual Testing Guide

This guide provides step-by-step instructions for manually testing the referral system.

---

## Prerequisites

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Database ready:**
   - Ensure Prisma schema is up to date: `npm run db:push`
   - Database has referral tables (Referral, ReferralEarning, ReferralPayout)

3. **Environment variables set:**
   ```bash
   REFERRAL_CODE_SALT=tfc_referral_salt_2026_secure
   REFERRAL_COMMISSION_T1=34
   REFERRAL_COMMISSION_T2=12
   REFERRAL_COMMISSION_T3=4
   ```

4. **Test wallets:**
   - Prepare 4 different Solana wallets for testing (UserA, UserB, UserC, UserD)
   - Each should have some SOL for gas

---

## Section 4.1: Background Job (NOT NEEDED)

✅ **Status:** Commissions are calculated inline with trades in `apps/web/src/app/api/orders/route.ts`

- When a trade is recorded, `calculateReferralCommissions()` is called automatically
- No separate background job needed
- Commissions are created in real-time, non-blocking

---

## Section 4.2: Testing - Referral Registration

### Test 1: User creates account → referral code generated

**Steps:**
1. Open application in browser
2. Connect wallet (UserA)
3. Complete wallet authentication
4. Open browser DevTools → Application → IndexedDB or check database

**Expected Result:**
- UserA should have a `referralCode` field in the database
- Referral code should be 16 characters, lowercase hex (e.g., `a1b2c3d4e5f6a7b8`)
- Referral code visible at `/referrals` page

**Database Query:**
```sql
SELECT id, handle, "referralCode" FROM users WHERE handle = 'UserA';
```

---

### Test 2: Visit with `?ref=CODE` → localStorage stores code

**Steps:**
1. Get UserA's referral code from `/referrals` page or database
2. Open browser in incognito/private mode
3. Visit: `http://localhost:3001?ref=<UserA_CODE>`
4. Open DevTools → Application → Local Storage
5. Look for key: `tfc_referral_code`

**Expected Result:**
- localStorage should contain: `tfc_referral_code: <UserA_CODE>`
- Value should persist even after page refresh

---

### Test 3: Connect wallet → T1 referral created

**Steps:**
1. Continue from Test 2 (localStorage has UserA's code)
2. Connect wallet (UserB)
3. Complete authentication
4. Check database for referral record

**Expected Result:**
- A referral record created with:
  - `referrerId`: UserA's ID
  - `referredId`: UserB's ID
  - `tier`: 1

**Database Query:**
```sql
SELECT * FROM referrals
WHERE "referredId" = (SELECT id FROM users WHERE handle = 'UserB');
```

**Additional Check:**
- UserB's `referredById` field should equal UserA's ID

---

### Test 4: T1 refers T2 → T2 chain created (T1, T2)

**Steps:**
1. Log out, clear localStorage
2. Get UserB's referral code
3. Visit: `http://localhost:3001?ref=<UserB_CODE>`
4. Connect wallet (UserC)
5. Check database

**Expected Result:**
- Two referral records created for UserC:
  1. `referrerId: UserB, referredId: UserC, tier: 1` (Direct)
  2. `referrerId: UserA, referredId: UserC, tier: 2` (Indirect)

**Database Query:**
```sql
SELECT r.tier, u.handle as referrer
FROM referrals r
JOIN users u ON r."referrerId" = u.id
WHERE r."referredId" = (SELECT id FROM users WHERE handle = 'UserC')
ORDER BY r.tier;
```

---

### Test 5: T2 refers T3 → T3 chain created (T1, T2, T3)

**Steps:**
1. Log out, clear localStorage
2. Get UserC's referral code
3. Visit: `http://localhost:3001?ref=<UserC_CODE>`
4. Connect wallet (UserD)
5. Check database

**Expected Result:**
- Three referral records created for UserD:
  1. `referrerId: UserC, referredId: UserD, tier: 1`
  2. `referrerId: UserB, referredId: UserD, tier: 2`
  3. `referrerId: UserA, referredId: UserD, tier: 3`

**Database Query:**
```sql
SELECT r.tier, u.handle as referrer
FROM referrals r
JOIN users u ON r."referrerId" = u.id
WHERE r."referredId" = (SELECT id FROM users WHERE handle = 'UserD')
ORDER BY r.tier;
```

---

### Test 6: Self-referral blocked

**Steps:**
1. Log out
2. Get UserA's referral code
3. Visit: `http://localhost:3001?ref=<UserA_CODE>`
4. Connect wallet UserA (same wallet that owns the code)

**Expected Result:**
- No referral record created
- UserA's `referredById` remains NULL
- Console log: "Referral registration skipped - Self-referral blocked"

---

### Test 7: Circular referral blocked

**Steps:**
1. UserB already has UserA as referrer (from Test 3)
2. Try to change UserB's referrer:
   - Get UserC's referral code
   - Visit: `http://localhost:3001?ref=<UserC_CODE>` (while logged in as UserB)
   - Or manually try to create a referral in DB

**Expected Result:**
- No new T1 referral created for UserB
- UserB's `referredById` remains UserA's ID
- Console log: "User already has a referrer, skipping"

---

## Section 4.3: Testing - Commissions

### Test 8: T3 user makes trade → all 3 referrers earn commissions

**Setup:**
- Ensure referral chain exists: UserA → UserB → UserC → UserD (from previous tests)
- UserD makes a trade with fee

**Steps:**
1. Log in as UserD
2. Go to `/trade` page
3. Execute a trade (any symbol, any direction)
4. Note the trade fee (e.g., $5.00)
5. Check database for commission earnings

**Expected Result:**
- Three `referral_earnings` records created:
  1. UserC earns 34% of fee (T1 referrer)
  2. UserB earns 12% of fee (T2 referrer)
  3. UserA earns 4% of fee (T3 referrer)

**Database Query:**
```sql
SELECT
  r.tier,
  u.handle as referrer,
  re."tradeFee",
  re."commissionPercent",
  re."commissionAmount"
FROM referral_earnings re
JOIN referrals r ON re."referrerId" = r."referrerId" AND re."traderId" = r."referredId"
JOIN users u ON re."referrerId" = u.id
WHERE re."traderId" = (SELECT id FROM users WHERE handle = 'UserD')
ORDER BY r.tier;
```

---

### Test 9: Commission percentages correct (34%, 12%, 4%)

**Using data from Test 8:**

If trade fee = $5.00:
- UserC (T1): $5.00 × 0.34 = $1.70
- UserB (T2): $5.00 × 0.12 = $0.60
- UserA (T3): $5.00 × 0.04 = $0.20

**Verification:**
```sql
SELECT
  tier,
  "commissionPercent",
  "commissionAmount"
FROM referral_earnings
WHERE "traderId" = (SELECT id FROM users WHERE handle = 'UserD')
ORDER BY tier;
```

---

### Test 10: Commission amounts calculated correctly

**Test with different fee amounts:**

1. UserD makes trade with $10 fee:
   - T1: $3.40
   - T2: $1.20
   - T3: $0.40

2. UserD makes trade with $100 fee:
   - T1: $34.00
   - T2: $12.00
   - T3: $4.00

**Verification:**
Check that `commissionAmount` = `tradeFee` × (`commissionPercent` / 100)

---

### Test 11: Earnings stored in database

**Steps:**
1. After UserD makes multiple trades
2. Check all earnings are recorded with correct fields

**Database Query:**
```sql
SELECT
  id,
  "referrerId",
  "traderId",
  "tradeId",
  tier,
  symbol,
  "tradeFee",
  "tradeValue",
  "commissionPercent",
  "commissionAmount",
  "isPaid",
  "earnedAt"
FROM referral_earnings
WHERE "traderId" = (SELECT id FROM users WHERE handle = 'UserD');
```

**Expected:**
- All fields populated correctly
- `isPaid` = false (unpaid)
- `earnedAt` timestamp set
- `tradeId` matches the trade record

---

## Section 4.4: Testing - API Endpoints

### Test 12: Dashboard returns correct stats

**Steps:**
1. Log in as UserA (has referrals)
2. Open DevTools → Network tab
3. Navigate to `/referrals`
4. Check API request: `GET /api/referrals/dashboard`

**Expected Response:**
```json
{
  "referralCode": "a1b2c3d4e5f6a7b8",
  "commissionRates": { "t1": 34, "t2": 12, "t3": 4 },
  "unclaimedPayout": 5.20,
  "totalReferrals": { "t1": 1, "t2": 1, "t3": 1, "total": 3 },
  "totalEarnings": { "total": 5.20, "t1": 1.70, "t2": 0.60, "t3": 4.00 },
  "referralVolume": { "t1": 500, "t2": 200, "t3": 100, "total": 800 },
  "recentReferrals": [...],
  "recentEarnings": [...],
  "payoutHistory": [...]
}
```

**Verify:**
- Totals match database queries
- Recent arrays populated
- Status 200 OK

---

### Test 13: Referrals list pagination works

**Steps:**
1. Logged in as UserA
2. Check: `GET /api/referrals/list?page=1&pageSize=20`
3. If > 20 referrals, test: `GET /api/referrals/list?page=2&pageSize=20`

**Expected Response:**
```json
{
  "referrals": [
    {
      "id": "...",
      "handle": "UserB",
      "tier": 1,
      "joinedAt": "2026-01-28T...",
      "totalTrades": 5,
      "totalVolume": 1000,
      "totalEarnings": 10.50
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 25,
    "totalPages": 2
  }
}
```

---

### Test 14: Earnings list with filters

**Test tier filter:**
```
GET /api/referrals/earnings?tier=1
GET /api/referrals/earnings?tier=2
GET /api/referrals/earnings?tier=3
```

**Test isPaid filter:**
```
GET /api/referrals/earnings?isPaid=false
GET /api/referrals/earnings?isPaid=true
```

**Test combined:**
```
GET /api/referrals/earnings?tier=1&isPaid=false&page=1&pageSize=10
```

---

### Test 15: Claim button disabled when < $10

**Steps:**
1. Log in as user with < $10 unclaimed
2. Navigate to `/referrals`
3. Check "Unclaimed Earnings" card

**Expected:**
- Claim button is grayed out/disabled
- Text shows: "Minimum $10 to claim"
- Shows current amount (e.g., "$5.20")

---

### Test 16: Claim creates payout record

**Steps:**
1. Log in as user with ≥ $10 unclaimed
2. Navigate to `/referrals`
3. Click "Claim Payout" button
4. Check API request: `POST /api/referrals/claim`
5. Check database

**Expected Response:**
```json
{
  "success": true,
  "payout": {
    "id": "...",
    "amount": 15.50,
    "status": "pending",
    "walletAddress": "...",
    "createdAt": "2026-01-28T..."
  },
  "earningsClaimed": 10,
  "message": "Successfully claimed $15.50. Payout is being processed."
}
```

**Database Verification:**
```sql
-- Check payout created
SELECT * FROM referral_payouts
WHERE "userId" = (SELECT id FROM users WHERE handle = 'UserA');

-- Check earnings marked as paid
SELECT COUNT(*) FROM referral_earnings
WHERE "referrerId" = (SELECT id FROM users WHERE handle = 'UserA')
AND "isPaid" = true;
```

---

## Section 4.5: Testing - UI

### Test 17: Referral code copy works

**Steps:**
1. Navigate to `/referrals`
2. Click "Copy Code" button
3. Paste into text editor

**Expected:**
- Toast notification: "Referral code copied!"
- Clipboard contains referral code
- Code is 16 characters

---

### Test 18: Share link copy works

**Steps:**
1. Navigate to `/referrals`
2. Click "Copy Link" button
3. Paste into text editor

**Expected:**
- Toast notification: "Referral link copied!"
- Clipboard contains: `http://localhost:3001?ref=<CODE>`
- Link is complete and clickable

---

### Test 19: Stats cards display correctly

**Verify on `/referrals` page:**

1. **Total Referrals card:**
   - Shows total number
   - Shows T1/T2/T3 breakdown
   - Icon displayed

2. **Total Earnings card:**
   - Shows dollar amount
   - Shows T1/T2/T3 breakdown
   - Correct formatting ($X.XX)

3. **Referral Volume card:**
   - Shows total trade volume
   - Shows T1/T2/T3 breakdown

---

### Test 20: Tabs navigation

**Steps:**
1. Click "Overview" tab → Content changes
2. Click "Referrals" tab → Content changes
3. Click "Payouts" tab → Content changes
4. Active tab highlighted

**Expected:**
- Tab content switches instantly
- Only one tab active at a time
- No page reload

---

### Test 21: Tables display data

**Overview Tab:**
- Recent Referrals table (last 10)
- Recent Earnings table (last 20)

**Payouts Tab:**
- Payout history table

**Verify:**
- Data displays in table format
- Columns aligned properly
- Hover effects work
- Mobile responsive

---

### Test 22: Pagination works

*Note: Currently full pagination is placeholder*

**When implemented:**
- Page numbers work
- Next/Previous buttons work
- Page size selector works
- Total pages calculated correctly

---

### Test 23: Empty states show

**Test empty states:**

1. **New user (no referrals):**
   - Recent Referrals: "No referrals yet"
   - Recent Earnings: "No earnings yet"

2. **No payouts yet:**
   - Payout History: "No payouts yet"

**Verify:**
- Icon displayed
- Message displayed
- No errors in console

---

### Test 24: Loading states

**Steps:**
1. Navigate to `/referrals`
2. Throttle network (DevTools → Network → Slow 3G)
3. Refresh page

**Expected:**
- Skeleton loading animation
- Pulsing gray blocks
- No content flash

---

### Test 25: Error handling

**Test API error:**
1. Stop API server
2. Navigate to `/referrals`

**Expected:**
- Error message displayed
- "Try again" button shown
- No white screen / crash

**Test invalid token:**
1. Manually corrupt auth token in localStorage
2. Navigate to `/referrals`

**Expected:**
- 401 Unauthorized
- Redirected to login or error shown

---

## Rate Limiting Test

### Test 26: Claim rate limiting (1 req/min)

**Steps:**
1. Claim payout (first attempt) → Should succeed
2. Immediately claim again → Should fail with 429
3. Wait 61 seconds → Should succeed again

**Expected Error (2nd attempt):**
```json
{
  "error": "Rate limit exceeded. Please wait before claiming again."
}
```

---

## Database Integrity Tests

### Test 27: Transaction safety on claim

**Steps:**
1. Claim payout
2. Immediately check database

**Verify atomicity:**
```sql
-- Both should happen together or not at all:

-- 1. Payout created
SELECT * FROM referral_payouts WHERE "userId" = '...';

-- 2. Earnings marked as paid
SELECT "isPaid", "paidAt" FROM referral_earnings
WHERE "referrerId" = '...' AND "isPaid" = true;
```

**Expected:**
- If payout exists, all earnings are marked paid
- If payout doesn't exist, no earnings marked paid
- No partial state

---

## Performance Tests

### Test 28: Dashboard query performance

**Steps:**
1. Add many referrals and earnings to database (simulate)
2. Navigate to `/referrals`
3. Check response time in Network tab

**Expected:**
- Dashboard loads in < 2 seconds
- No N+1 queries
- Proper indexes used

---

## Summary Checklist

After completing all tests, verify:

- [ ] Referral codes generated on signup
- [ ] URL param tracking works
- [ ] 3-tier chain creation works
- [ ] Self-referral blocked
- [ ] Circular referral blocked
- [ ] Commissions calculated correctly
- [ ] All 3 tiers earn commissions
- [ ] API endpoints return correct data
- [ ] Pagination works (when implemented)
- [ ] Claim button validation works
- [ ] Payout creation works
- [ ] UI displays data correctly
- [ ] Copy/share buttons work
- [ ] Empty states display
- [ ] Loading states display
- [ ] Error handling works
- [ ] Rate limiting works
- [ ] Transaction safety verified

---

## Next Steps

After completing manual tests:

1. Document any bugs found
2. Fix issues
3. Re-test fixed issues
4. Update checklist with results
5. Prepare for production deployment
