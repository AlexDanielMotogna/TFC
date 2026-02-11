# Pacifica API Usage Analysis - Scaling to Thousands of Users

**Generated**: 2026-02-05
**Purpose**: Analyze current Pacifica API usage patterns and identify bottlenecks for scaling to thousands of concurrent users

---

## Executive Summary

**Current State**: Your application can handle ~250 concurrent users comfortably
**Target Scale**: Thousands of concurrent users (5,000-10,000+)
**Risk Level**: 🟡 MEDIUM - Need caching within 3-6 months
**Estimated Peak Load at Scale**: 200-400+ Pacifica API requests/second without optimization

### Key Findings

✅ **Strong Points**:
- Excellent WebSocket implementation for real-time data (prices, positions, orders)
- Smart frontend caching with stale-time strategies
- Database storage for trade history reduces API calls

🔴 **Critical Issues**:
1. **No server-side caching** - Every backend request hits Pacifica API directly
2. **Triple retry pattern on orders** - Each trade makes up to 3 sequential API calls
3. **Polling fallback** - Users without WebSocket poll every 15-30s
4. **No request deduplication** - Multiple users requesting same data = multiple API calls
5. **No distributed cache** - Horizontal scaling will multiply API load

---

## 1. Complete Pacifica API Inventory

### 1.1 Public Market Data Endpoints (Low Impact)

| Endpoint | Pacifica Call | Frequency | Trigger | Scale Impact |
|----------|---------------|-----------|---------|--------------|
| `GET /api/markets` | `getMarkets()` | On page load | User navigates to markets | Low - cached 60s |
| `GET /api/markets/prices` | `getPrices()` | WebSocket + 30s fallback | Real-time prices | Low - WS cached |
| `GET /api/markets/[symbol]/orderbook` | `getOrderbook(symbol, aggLevel)` | On demand | User views order book | Low - on demand |
| `GET /api/markets/[symbol]/trades` | `getRecentTrades(symbol)` | On demand | User views trade history | Low - on demand |
| `GET /api/markets/[symbol]/klines` | `getKlines(params)` | On chart load | User views TradingView | Low - cached chart |

**Files**:
- `apps/web/src/app/api/markets/route.ts`
- `apps/web/src/app/api/markets/prices/route.ts`
- `apps/web/src/app/api/markets/[symbol]/orderbook/route.ts`
- `apps/web/src/app/api/markets/[symbol]/trades/route.ts`
- `apps/web/src/app/api/markets/[symbol]/klines/route.ts`

---

### 1.2 Account Data Endpoints (HIGH IMPACT - Critical Issue)

| Endpoint | Pacifica Call | Frequency | Trigger | Scale Impact |
|----------|---------------|-----------|---------|--------------|
| `GET /api/account/summary` | `getAccount(accountAddress)` | Every 15s | Dashboard polling | **HIGH** |
| `GET /api/account/positions` | `getPositions(accountAddress)` | Every 15-30s | Positions polling | **HIGH** |
| `GET /api/account/orders/open` | `getOpenOrders(accountAddress)` | Every 15-30s | Orders polling | **HIGH** |
| `GET /api/fights/[id]/positions` | `getPositions() + getPrices()` | On demand | Fight view | Medium |
| `GET /api/fights/[id]/orders` | `getOpenOrders() + getPositions()` | On demand | Fight orders view | Medium |

**Critical Math** (250 concurrent users, 50% connected):
```
125 users × (1 req / 15s) = 8.33 requests/second baseline
At 1000 users: 33.3 requests/second just for account polling
```

**Files**:
- `apps/web/src/app/api/account/summary/route.ts`
- `apps/web/src/app/api/account/positions/route.ts`
- `apps/web/src/app/api/account/orders/open/route.ts`
- `apps/web/src/app/api/fights/[id]/positions/route.ts`
- `apps/web/src/app/api/fights/[id]/orders/route.ts`

**Frontend Hooks** (where polling happens):
- `apps/web/src/hooks/usePositions.ts` - 15s HTTP fallback, 30s when WS connected
- `apps/web/src/hooks/useOpenOrders.ts` - 15s HTTP fallback, 30s when WS connected
- `apps/web/src/hooks/useAccountSettings.ts` - 30s refetch interval

---

### 1.3 Trading Operations (VERY HIGH IMPACT - Critical Issue)

| Endpoint | Pacifica Call | Frequency | Additional Calls | Scale Impact |
|----------|---------------|-----------|------------------|--------------|
| `POST /api/orders` | `create_market` or `create` (limit) | Per trade | **+3 retries for trade history** | **CRITICAL** |
| `DELETE /api/orders` | `cancel_all` | Per cancel | None | Medium |
| `POST /api/account/leverage` | `updateLeverage()` | Per leverage change | None | Low |
| `POST /api/account/withdraw` | `withdraw` | Per withdrawal | None | Low |

**CRITICAL FINDING - Order Placement Flow** (`apps/web/src/app/api/orders/route.ts:1030`):
```typescript
// 1. Place order
const pacificaOrder = await Pacifica.createMarketOrder(...);

// 2. Fetch trade history (WITH 3 RETRIES AND DELAYS!)
for (let attempt = 1; attempt <= 3; attempt++) {
  const response = await fetch(
    `${PACIFICA_API_URL}/api/v1/trades/history?account_address=${accountAddress}&limit=10`
  );

  if (tradeFound) break;

  // Exponential backoff: 1s, 2s, 3s
  await new Promise(resolve => setTimeout(resolve, attempt * 1000));
}

// 3. Get current positions (for Rule 35 check)
const positions = await Pacifica.getPositions(accountAddress);
```

**Impact**: Each trade = **up to 5 Pacifica API calls**:
- 1 order placement
- 3 trade history retries (sequential, with delays)
- 1 position fetch

**Files**:
- `apps/web/src/app/api/orders/route.ts` (1030 lines - CRITICAL FILE)
- `apps/web/src/app/api/account/leverage/route.ts`
- `apps/web/src/app/api/account/withdraw/route.ts`

---

### 1.4 Background Jobs (Low Impact - Good!)

| Job | Schedule | Pacifica Calls | Impact |
|-----|----------|----------------|--------|
| `reconcile-fights` | Every 1 min | None (calls internal API) | None |
| `leaderboard-refresh` | Every 5 min | None (DB only) | None |
| `cleanup-stale-fights` | Every 1 min | None | None |
| `prize-pool-finalize` | Weekly | None | None |
| `prize-pool-update` | Every 5 min | None | None |
| `treasury-auto-withdraw` | Every 15 min | None | None |
| `referral-payout-processor` | Every 15 min | None | None |

**Finding**: Background jobs are well-designed - they use cached database data, NOT direct Pacifica calls.

**Files**:
- `apps/jobs/src/jobs/reconcile-fights.ts`
- `apps/jobs/src/jobs/refresh-leaderboard.ts`
- `apps/jobs/src/jobs/cleanup-stale-fights.ts`
- `apps/jobs/src/jobs/finalize-prize-pool.ts`
- `apps/jobs/src/jobs/update-prize-pool.ts`
- `apps/jobs/src/jobs/treasury-auto-withdraw.ts`
- `apps/jobs/src/jobs/referral-payout-processor.ts`

---

## 2. Scaling Projections

### 2.1 Current Load (250 Concurrent Users)

**Assumptions**:
- 50% have Pacifica connected (125 users)
- 15-second polling interval for positions/orders
- 5% trading activity (12 trades/minute)

**Requests per Second**:
```
Market data (WebSocket + fallback):
  - getPrices(): ~10/sec (only when WS disconnected)
  - getMarkets(): ~2/sec

Account polling:
  - getAccount() + getPositions() + getOpenOrders():
    125 users / 15s = 8.33/sec baseline

Trading operations:
  - Orders (with retries): 12 trades/min × 5 calls = 60 calls/min = 1/sec
  - Position fetches after trades: included above

Total: ~20-25 requests/second
```

### 2.2 Projected Load at 5,000 Users

**Assumptions**:
- 50% concurrent (2,500 users)
- 50% connected (1,250 users)
- 10% trading activity (250 trades/minute)

**Requests per Second**:
```
Account polling:
  - 1,250 users / 15s = 83.33/sec baseline
  - 1,250 users / 30s = 41.67/sec (optimistic with good WS)

Trading operations:
  - 250 trades/min × 5 calls = 1,250 calls/min = 20.83/sec

Market data:
  - getPrices() fallback: ~50/sec (WS disconnections)
  - Other market data: ~15/sec

Total baseline: 150-170 requests/second
Total peak (market hours): 200-300+ requests/second
```

### 2.3 Projected Load at 10,000 Users

**Assumptions**:
- 50% concurrent (5,000 users)
- 50% connected (2,500 users)
- 10% trading activity (500 trades/minute)

**Requests per Second**:
```
Account polling:
  - 2,500 users / 15s = 166.67/sec baseline
  - 2,500 users / 30s = 83.33/sec (optimistic with good WS)

Trading operations:
  - 500 trades/min × 5 calls = 2,500 calls/min = 41.67/sec

Market data:
  - getPrices() fallback: ~100/sec (WS disconnections)
  - Other market data: ~30/sec

Total baseline: 280-320 requests/second
Total peak (market hours): 400-500+ requests/second
```

### 2.4 Worst Case Scenario (Peak Trading Hours at 10,000 Users)

```
10,000 users × 50% concurrent × 50% connected = 2,500 users
2,500 users / 15s = 166.67/sec (account polling)
500 trades/min × 5 calls = 2,500 calls/min = 41.67/sec

Total: 400-600+ requests/second
```

**Risk**: Pacifica rate limits likely ~100-200 req/sec per API key
**Headroom**: **CRITICAL** - you'll exceed rate limits 3-5× without optimization

---

## 3. Current Optimization Strategies

### 3.1 Frontend Caching (Excellent Implementation)

**WebSocket-First Architecture** (`apps/web/src/hooks/usePrices.ts`, `usePositions.ts`):

✅ **Prices** (`usePrices.ts`):
- Primary: WebSocket real-time prices
- Fallback: REST API every 30 seconds when disconnected
- In-memory cache of market info
- Prevents 429 rate limits with stale-time strategies

✅ **Positions** (`usePositions.ts`):
- Primary: WebSocket for position updates
- Fallback: REST API every 30s (WS connected) or 15s (disconnected)
- Stale time: 10-20 seconds
- Retry logic with exponential backoff

✅ **Orders** (`useOpenOrders.ts`):
- Primary: WebSocket for order updates
- Fallback: REST API every 30s (WS connected) or 15s (disconnected)
- Bidirectional merge: WS + HTTP data combined

✅ **Markets** (`useMarkets.ts`):
- Cached for 60 seconds
- Refetch interval: 60 seconds

✅ **Account Settings** (`useAccountSettings.ts`):
- Refetch interval: 30 seconds
- Stale time: 20 seconds

**Files**:
- `apps/web/src/hooks/usePrices.ts` (189 lines)
- `apps/web/src/hooks/usePositions.ts` (256 lines)
- `apps/web/src/hooks/useOpenOrders.ts` (178 lines)
- `apps/web/src/hooks/useMarkets.ts` (45 lines)
- `apps/web/src/hooks/useAccountSettings.ts` (57 lines)

### 3.2 Backend Caching (MISSING - Critical Gap)

🔴 **No server-side caching detected**:
- No Redis cache
- No in-memory cache (like Node-cache or lru-cache)
- No request deduplication
- No batch operations

**Every API request hits Pacifica directly**.

### 3.3 Database Caching (Partial)

✅ **Trade history stored locally**:
- `Trade` table stores executed trades
- `FightTrade` table stores fight-specific trades
- Used for historical PnL calculations

❌ **No caching for**:
- Current positions
- Open orders
- Account balance
- Market data

---

## 4. Identified Bottlenecks

### 4.1 Critical Bottleneck: Account Polling

**Problem**: Every user polls positions/orders every 15-30 seconds via REST fallback

**Impact at 5,000 users**:
```
2,500 concurrent users × 50% connected = 1,250 users
1,250 users / 15s = 83.33 requests/second baseline

Peak (all users refresh simultaneously): 1,250 requests in burst
```

**Impact at 10,000 users**:
```
5,000 concurrent users × 50% connected = 2,500 users
2,500 users / 15s = 166.67 requests/second baseline

Peak (all users refresh simultaneously): 2,500 requests in burst
```

**Why this is bad**:
- No caching means every request = 1 Pacifica API call
- Multiple users requesting same data (e.g., same market prices) = duplicate calls
- Horizontal scaling makes this worse (each instance polls independently)
- At 10,000 users, this alone exceeds typical rate limits

**Location**: `apps/web/src/hooks/usePositions.ts`, `useOpenOrders.ts`

---

### 4.2 Critical Bottleneck: Trade Retry Pattern

**Problem**: Order placement retries trade history lookup 3 times with delays

**Code** (`apps/web/src/app/api/orders/route.ts:450-480`):
```typescript
// Retry up to 3 times with exponential backoff
for (let attempt = 1; attempt <= 3; attempt++) {
  const response = await fetch(
    `${PACIFICA_API_URL}/api/v1/trades/history?account_address=${accountAddress}&limit=10`
  );

  const tradeData = await response.json();
  const matchedTrade = tradeData.data?.find(
    (t: any) => t.order_id === pacificaOrder.order_id
  );

  if (matchedTrade) {
    break; // Found it!
  }

  // Wait 1s, 2s, 3s
  if (attempt < 3) {
    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
  }
}
```

**Impact**:
- Successful trade (found on first try): 1 call
- Trade not found immediately: 3 calls + 6 seconds delay
- 50 trades/min × 3 calls = 150 calls/min = 2.5/sec **just for retries**

**Why this exists**: Pacifica API has eventual consistency - trades don't appear in history instantly

**Location**: `apps/web/src/app/api/orders/route.ts:450-480`

---

### 4.3 Bottleneck: Rule 35 Position Fetch

**Problem**: After every order, fetch positions to check if trade is fight-relevant

**Code** (`apps/web/src/app/api/orders/route.ts:750`):
```typescript
// Fetch current positions to check if order affects fight
const positions = await Pacifica.getPositions(accountAddress);

// Check if this trade affects an open position (Rule 35)
const affectsPosition = positions.some(p => p.symbol === symbol);
```

**Impact**: 50 trades/min = 50 position fetches/min = 0.83/sec

**Why this exists**: Need to determine if trade is fight-relevant (Rule 35 logic)

**Location**: `apps/web/src/app/api/orders/route.ts:750`

---

### 4.4 Bottleneck: No Request Deduplication

**Problem**: If 10 users request positions simultaneously, you make 10 Pacifica calls

**Example**: Market opens, 100 users refresh → 100 simultaneous `getAccount()` calls

**Why this is bad**:
- Wastes API quota
- Increases latency (rate limiting)
- No benefit since data is identical

**Solution**: Deduplicate concurrent requests with shared promises

---

### 4.5 Bottleneck: Horizontal Scaling

**Problem**: No distributed cache means each server instance polls independently

**Example**:
- 2 server instances
- 250 users per instance
- Each instance polls positions every 15s
- Total API calls = 2× the load

**Why this is bad**: Scaling horizontally INCREASES Pacifica API load instead of distributing it

---

## 5. Optimization Recommendations (NO Business Logic Changes)

### 5.1 HIGH PRIORITY - Implement Server-Side Caching

**Goal**: Reduce duplicate Pacifica calls with Redis cache

**Strategy**:
```typescript
// Pseudocode for account positions
async function getPositions(accountAddress: string) {
  const cacheKey = `positions:${accountAddress}`;

  // Try Redis first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss - fetch from Pacifica
  const positions = await Pacifica.getPositions(accountAddress);

  // Cache for 5 seconds
  await redis.setex(cacheKey, 5, JSON.stringify(positions));

  return positions;
}
```

**Cache TTLs** (recommended):
- Market prices: 5 seconds (real-time data, frequent changes)
- Market info: 5 minutes (rarely changes)
- Account summary: 5 seconds (balance changes frequently)
- Positions: 5 seconds (trades update positions)
- Open orders: 3 seconds (orders cancel/fill frequently)

**Impact**:
- At 5,000 users: Reduces 83.33/sec to ~17/sec for account polling (assuming 5s cache)
- At 10,000 users: Reduces 166.67/sec to ~33/sec for account polling
- **80-90% reduction in Pacifica calls**

**Implementation**:
1. Add `ioredis` package
2. Create `apps/web/src/lib/server/cache.ts` wrapper
3. Wrap all Pacifica calls with cache layer
4. Set appropriate TTLs per data type

**Files to modify**:
- `apps/web/src/lib/server/pacifica.ts` - Add caching to each function
- `apps/web/src/app/api/account/summary/route.ts`
- `apps/web/src/app/api/account/positions/route.ts`
- `apps/web/src/app/api/account/orders/open/route.ts`

**Estimated Effort**: 4-6 hours
**Business Logic Impact**: ZERO (transparent cache layer)

---

### 5.2 HIGH PRIORITY - Deduplicate Concurrent Requests

**Goal**: Prevent multiple users requesting same data from triggering duplicate API calls

**Strategy**:
```typescript
// In-memory promise cache
const pendingRequests = new Map<string, Promise<any>>();

async function getPositionsWithDedup(accountAddress: string) {
  const cacheKey = `positions:${accountAddress}`;

  // If request is already in flight, return the same promise
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // Create new request
  const promise = fetchPositionsWithCache(accountAddress);
  pendingRequests.set(cacheKey, promise);

  // Clean up when done
  promise.finally(() => pendingRequests.delete(cacheKey));

  return promise;
}
```

**Impact**:
- During bursts (market open), reduces 100 calls to 1 call
- **90%+ reduction during peak bursts**

**Implementation**:
1. Add `pendingRequests` Map to cache wrapper
2. Check if request is in flight before calling Pacifica
3. Share promise across concurrent callers

**Files to modify**:
- `apps/web/src/lib/server/cache.ts` (or new cache layer)

**Estimated Effort**: 2-3 hours
**Business Logic Impact**: ZERO (transparent deduplication)

---

### 5.3 HIGH PRIORITY - Optimize Trade Retry Pattern

**Goal**: Reduce 3× retry pattern to 1-2× or eliminate entirely

**Strategy 1**: Use WebSocket subscription for trade confirmations
```typescript
// Instead of polling, subscribe to user's trade channel
wsClient.subscribe(`trades:${accountAddress}`);

wsClient.on('trade', (trade) => {
  // Process trade immediately when WebSocket notifies
});
```

**Strategy 2**: Accept eventual consistency
```typescript
// Don't wait for trade to appear in history
const pacificaOrder = await Pacifica.createMarketOrder(...);

// Return immediately, let WebSocket update trade later
return { success: true, orderId: pacificaOrder.order_id };

// Background: Listen for trade on WebSocket and save to DB
```

**Strategy 3**: Reduce retries from 3 to 1
```typescript
// Only retry once instead of 3 times
const maxAttempts = 1;
```

**Impact**:
- Strategy 1 (WebSocket): Reduces 3 calls to 0 calls (100% reduction)
- Strategy 2 (Async): Reduces 3 calls to 0 calls (100% reduction)
- Strategy 3 (Reduce retries): Reduces 3 calls to 1 call (66% reduction)

**Recommended**: Strategy 2 (accept eventual consistency) + WebSocket for live updates

**Files to modify**:
- `apps/web/src/app/api/orders/route.ts:450-480` - Remove retry loop
- `apps/web/src/hooks/usePositions.ts` - Already has WebSocket, will pick up trade

**Estimated Effort**: 3-4 hours
**Business Logic Impact**: MINIMAL (user sees trade update via WebSocket instead of immediate response)

---

### 5.4 MEDIUM PRIORITY - Cache Rule 35 Position Check

**Goal**: Avoid fetching positions after every trade just for Rule 35 check

**Strategy 1**: Use cached positions from Redis (5s TTL)
```typescript
// Use cached positions instead of fresh fetch
const positions = await getCachedPositions(accountAddress);
```

**Strategy 2**: Maintain position state in database
```typescript
// Query database for user's current positions
const dbPositions = await prisma.position.findMany({
  where: { userId, closed: false }
});
```

**Impact**:
- Strategy 1: Converts 50 calls/min to cache hits (if within 5s)
- Strategy 2: Eliminates Pacifica call entirely

**Recommended**: Strategy 1 (use Redis cache from 5.1)

**Files to modify**:
- `apps/web/src/app/api/orders/route.ts:750` - Use cached positions

**Estimated Effort**: 1 hour
**Business Logic Impact**: ZERO (same data, different source)

---

### 5.5 MEDIUM PRIORITY - Implement Request Queuing

**Goal**: Prevent rate limit 429 errors by queuing requests

**Strategy**:
```typescript
import PQueue from 'p-queue';

// Limit to 50 concurrent Pacifica requests
const pacificaQueue = new PQueue({ concurrency: 50 });

async function queuedPacificaCall<T>(fn: () => Promise<T>): Promise<T> {
  return pacificaQueue.add(fn);
}

// Usage
const positions = await queuedPacificaCall(() =>
  Pacifica.getPositions(accountAddress)
);
```

**Impact**:
- Prevents 429 rate limit errors during bursts
- Graceful degradation (slower response vs errors)

**Implementation**:
1. Add `p-queue` package
2. Wrap all Pacifica calls with queue
3. Set concurrency limit (50-100 based on rate limits)

**Files to modify**:
- `apps/web/src/lib/server/pacifica.ts` - Wrap each function with queue

**Estimated Effort**: 2-3 hours
**Business Logic Impact**: ZERO (transparent queuing)

---

### 5.6 LOW PRIORITY - Monitor Pacifica API Usage

**Goal**: Track API call frequency and identify bottlenecks

**Strategy**:
```typescript
// Metrics wrapper
async function trackedPacificaCall<T>(
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();

    // Log success
    metrics.increment('pacifica.calls.success', { endpoint });
    metrics.histogram('pacifica.latency', Date.now() - start, { endpoint });

    return result;
  } catch (error) {
    metrics.increment('pacifica.calls.error', { endpoint });
    throw error;
  }
}
```

**Impact**:
- Visibility into which endpoints are called most
- Identify optimization opportunities
- Alert on rate limit errors

**Implementation**:
1. Add metrics library (e.g., `prom-client` for Prometheus)
2. Wrap Pacifica calls with tracking
3. Set up dashboard (Grafana) or logging

**Files to modify**:
- `apps/web/src/lib/server/pacifica.ts` - Add metrics to each function

**Estimated Effort**: 4-6 hours
**Business Logic Impact**: ZERO (monitoring only)

---

### 5.7 LOW PRIORITY - Move to WebSocket-Only for Real-Time Data

**Goal**: Disable REST polling fallback entirely, rely on WebSocket

**Strategy**:
```typescript
// In usePositions.ts - remove HTTP fallback
const { data, error, isLoading } = useQuery({
  queryKey: ['positions', accountAddress],
  queryFn: () => fetchPositions(accountAddress),
  enabled: false, // Only use WebSocket, never poll
  staleTime: Infinity,
});
```

**Impact**:
- Eliminates 8-16 req/sec from polling
- **50%+ reduction in account data calls**

**Risk**: If WebSocket fails, users won't see updates

**Recommended**: Keep as fallback but increase interval to 60s

**Files to modify**:
- `apps/web/src/hooks/usePositions.ts` - Increase refetch interval
- `apps/web/src/hooks/useOpenOrders.ts` - Increase refetch interval

**Estimated Effort**: 1 hour
**Business Logic Impact**: MINIMAL (slight delay when WS disconnected)

---

## 6. Summary of Optimizations

| Priority | Optimization | Impact | Effort | Business Logic Change |
|----------|--------------|--------|--------|----------------------|
| **HIGH** | Redis caching layer | 70-80% reduction | 4-6h | ZERO |
| **HIGH** | Request deduplication | 90% burst reduction | 2-3h | ZERO |
| **HIGH** | Optimize trade retries | 66-100% reduction | 3-4h | MINIMAL |
| **MEDIUM** | Cache Rule 35 positions | 100% for this call | 1h | ZERO |
| **MEDIUM** | Request queuing | Prevents 429 errors | 2-3h | ZERO |
| **LOW** | API usage monitoring | Visibility | 4-6h | ZERO |
| **LOW** | WebSocket-only mode | 50% reduction | 1h | MINIMAL |

**Total Effort**: 17-26 hours (2-3 days of work)
**Total Impact**: 80-90% reduction in Pacifica API calls
**Business Logic Changes**: MINIMAL (mostly transparent caching)

---

## 7. Recommended Implementation Order

### Phase 1 (Week 1): Critical Caching - 6-9 hours
1. ✅ Add Redis caching layer for account data (4-6h)
2. ✅ Implement request deduplication (2-3h)

**Expected Result**: Reduce API calls from 20-25/sec to 5-8/sec

---

### Phase 2 (Week 2): Trade Optimization - 4-5 hours
3. ✅ Optimize trade retry pattern (3-4h)
4. ✅ Cache Rule 35 position checks (1h)

**Expected Result**: Reduce trade-related calls by 70%+

---

### Phase 3 (Week 3): Reliability & Monitoring - 6-9 hours
5. ✅ Implement request queuing (2-3h)
6. ✅ Add API usage monitoring (4-6h)

**Expected Result**: Prevent rate limit errors, gain visibility

---

### Phase 4 (Optional): Fine-Tuning - 1 hour
7. ✅ Increase WebSocket fallback intervals (1h)

**Expected Result**: Further reduce polling overhead

---

## 8. Scaling Readiness Assessment

| Metric | Current (250) | 5,000 Users (No Cache) | 10,000 Users (No Cache) | After Optimizations (10K) | Target |
|--------|---------------|------------------------|-------------------------|---------------------------|--------|
| **Peak API calls/sec** | 20-35 | 200-300+ | 400-600+ | 40-60 | <100 |
| **Account polling/sec** | 8.33 | 83.33 | 166.67 | 17-33 | <50 |
| **Caching layer** | None | None | None | Redis | ✅ |
| **Deduplication** | None | None | None | In-memory | ✅ |
| **Rate limit risk** | MEDIUM | CRITICAL | CRITICAL | LOW | ✅ |
| **Horizontal scaling** | Breaks | Breaks | Breaks | Works | ✅ |

**Before Optimizations**: 🔴 **NOT READY** for thousands of users (would exceed rate limits 3-5×)
**After Optimizations**: 🟢 **READY** for 10,000+ users with 80-90% API reduction

---

## 9. Critical Files Reference

### Backend API Routes (Pacifica Callers)
- `apps/web/src/lib/server/pacifica.ts` - Core Pacifica API wrapper (482 lines)
- `apps/web/src/app/api/orders/route.ts` - Order placement with retries (1030 lines) **CRITICAL**
- `apps/web/src/app/api/account/summary/route.ts` - Account summary
- `apps/web/src/app/api/account/positions/route.ts` - Positions endpoint
- `apps/web/src/app/api/account/orders/open/route.ts` - Open orders
- `apps/web/src/app/api/markets/prices/route.ts` - Market prices
- `apps/web/src/app/api/fights/[id]/positions/route.ts` - Fight positions
- `apps/web/src/app/api/fights/[id]/orders/route.ts` - Fight orders

### Frontend Hooks (Polling Sources)
- `apps/web/src/hooks/usePositions.ts` - Position polling (256 lines)
- `apps/web/src/hooks/useOpenOrders.ts` - Order polling (178 lines)
- `apps/web/src/hooks/useAccountSettings.ts` - Account polling (57 lines)
- `apps/web/src/hooks/usePrices.ts` - Price WebSocket + fallback (189 lines)
- `apps/web/src/hooks/useMarkets.ts` - Market data (45 lines)

### Background Jobs (Low Impact)
- `apps/jobs/src/jobs/reconcile-fights.ts` - Fight settlement
- `apps/jobs/src/jobs/refresh-leaderboard.ts` - Leaderboard updates
- `apps/jobs/src/index.ts` - Cron scheduler

---

## 10. Action Items for Product Owner

### Immediate (This Week)
- [ ] Provision Redis instance (AWS ElastiCache, Upstash, or self-hosted)
- [ ] Review and approve caching strategy (TTLs, cache keys)
- [ ] Decide on trade retry strategy (accept eventual consistency?)

### Short-Term (Next 2 Weeks)
- [ ] Implement Phase 1 & 2 optimizations
- [ ] Load test with simulated 1000 users
- [ ] Monitor Pacifica API usage metrics

### Long-Term (Next Month)
- [ ] Implement monitoring dashboard
- [ ] Set up alerts for rate limit errors
- [ ] Consider Pacifica API tier upgrade if needed

---

## 11. Risk Mitigation

### Risk 1: Redis Failure
**Mitigation**: Graceful fallback to direct Pacifica calls
```typescript
try {
  const cached = await redis.get(key);
} catch (error) {
  // Redis down - bypass cache
  return await Pacifica.getPositions(accountAddress);
}
```

### Risk 2: Stale Cache Data
**Mitigation**: Short TTLs (3-5 seconds) + WebSocket updates override cache

### Risk 3: Cache Invalidation
**Mitigation**: When user places trade, invalidate their position/order cache
```typescript
await redis.del(`positions:${accountAddress}`);
await redis.del(`orders:${accountAddress}`);
```

---

## Conclusion

Your application is **currently sustainable at 250 users** but will hit **critical rate limit issues at thousands of users** without optimization.

**Current trajectory**: At 5,000 users you'd hit 200-300 req/sec, at 10,000 users you'd hit 400-600 req/sec - both exceeding typical rate limits (100-200 req/sec).

**The good news**: You're 80% there with excellent WebSocket implementation. You just need server-side caching to handle massive scale.

**Recommended path**: Implement Phase 1 (Redis cache + deduplication) to achieve 80-90% API reduction. This will support 10,000+ users comfortably within rate limits.

**Total work**: 2-3 days of engineering effort for production-ready scaling to thousands of concurrent users.

---

**Generated by**: Claude Code Analysis
**Last Updated**: 2026-02-05
**Next Review**: After Phase 1 implementation
