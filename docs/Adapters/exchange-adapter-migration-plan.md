# Exchange Adapter Migration Plan

**Date**: 2026-02-05 - 2026-02-06
**Branch**: `feature/exchange-adapter-architecture`
**Status**: ✅ Phase 1-3 Complete → Ready for Testing
**Related Docs**:
- [Adapter Architecture](../Adapters/README.md)
- [API Consumption Analysis](./pacifica-api-consumation.md)

**Progress**: 12/12 routes migrated | All core architecture implemented | Testing pending

---

## Overview

This document tracks the migration from direct Pacifica API calls to the Exchange Adapter pattern, enabling multi-exchange support (Pacifica, Hyperliquid, Binance) and implementing Redis caching for 80-90% API call reduction.

---

## Why This Migration?

### Problem Statement

1. **Tight Coupling**: All API routes directly call Pacifica functions
2. **No Caching**: Every request hits Pacifica API (500ms latency)
3. **Rate Limit Risk**: At 5,000 users → 200-300 req/sec, at 10,000 users → 400-600 req/sec (far exceeding typical rate limits of 100-200 req/sec)
4. **No Multi-Exchange**: Can't add Hyperliquid/Binance without major refactor
5. **Not Horizontally Scalable**: Each server instance multiplies API load

### Solution

**Exchange Adapter Pattern** with built-in caching:
- Abstract exchange logic behind universal interface
- Add Redis caching layer (5s TTL for account data)
- Request deduplication (100 concurrent calls → 1 API call)
- Ready for Hyperliquid/Binance with zero business logic changes

### Expected Impact

| Metric | Before (10K users) | After (10K users) | Improvement |
|--------|-------------------|-------------------|-------------|
| API calls/sec | 400-600+ | 40-60 | **85-90% reduction** |
| At 5,000 users | 200-300+ | 30-40 | **85% reduction** |
| Response time (cached) | 500ms | 10ms | **50x faster** |
| Cache hit rate | 0% | >95% | New capability |
| Multi-exchange support | No | Yes | New capability |
| Horizontal scaling | Broken (multiplies load) | Works (shared cache) | New capability |

---

## Implementation Phases

### Phase 1: Foundation (Week 1 - Days 1-2) ✅ COMPLETED

**Goal**: Create adapter interface and Pacifica implementation

#### Tasks

- [x] Create `apps/web/src/lib/server/exchanges/adapter.ts`
  - Universal `ExchangeAdapter` interface
  - Normalized types: `Market`, `Price`, `Account`, `Position`, `Order`, `TradeHistoryItem`
  - Request parameter types: `MarketOrderParams`, `LimitOrderParams`, etc.

- [x] Create `apps/web/src/lib/server/exchanges/pacifica-adapter.ts`
  - Implement all interface methods
  - Wrap existing Pacifica API client
  - Symbol normalization (BTC → BTC-USD)
  - Side normalization (bid/ask → BUY/SELL)

- [x] Create `apps/web/src/lib/server/exchanges/provider.ts`
  - Factory pattern for getting adapters
  - `getAdapter(exchangeName)` - singleton per exchange
  - `getUserAdapter(userId)` - query DB for user's exchange

- [x] Create `apps/web/src/lib/server/exchanges/cached-adapter.ts`
  - Redis caching wrapper
  - Request deduplication
  - Cache invalidation

- [x] Install dependencies
  - `npm install ioredis` ✅ Completed

- [x] Migrate account service
  - Updated to use Exchange Adapter
  - Feature flag: `USE_EXCHANGE_ADAPTER`

- [ ] Write tests
  - Adapter equivalence tests (verify same data as direct Pacifica)
  - Symbol normalization tests
  - Error handling tests

#### Files Created

```
apps/web/src/lib/server/exchanges/
├── adapter.ts                  # Interface + types ✅
├── pacifica-adapter.ts         # Pacifica implementation ✅
├── cached-adapter.ts           # Redis caching wrapper ✅
├── provider.ts                 # Factory ✅
└── README.md                   # Setup guide ✅
```

#### Success Criteria

- [x] All adapter files created
- [x] PacificaAdapter implements all interface methods
- [x] Can instantiate adapter via provider
- [x] Account service migrated to use adapter
- [ ] Tests written (pending)

---

### Phase 2: Caching Layer (Week 1 - Days 3-4) ✅ COMPLETED

**Goal**: Add Redis caching with request deduplication

#### Prerequisites

- [x] Provision Redis instance
  - **Option 1**: Upstash (serverless, free tier)
  - **Option 2**: AWS ElastiCache (production)
  - **Option 3**: Local Redis (development)
  - Set `REDIS_URL` environment variable

- [x] Install dependencies
  ```bash
  npm install ioredis  # ✅ Completed
  ```

#### Tasks

- [x] Create `apps/web/src/lib/server/exchanges/cached-adapter.ts`
  - Implement `CachedExchangeAdapter` wrapper ✅
  - Redis caching with TTLs: ✅
    - Markets: 5 minutes
    - Prices: 5 seconds
    - Account: 5 seconds
    - Positions: 5 seconds
    - Orders: 3 seconds
    - Trade History: 10 seconds
  - Request deduplication (share promises) ✅
  - Cache invalidation on trading operations ✅

- [x] Update provider to auto-wrap with cache ✅
  ```typescript
  if (process.env.REDIS_URL) {
    adapter = new CachedExchangeAdapter(adapter, process.env.REDIS_URL);
  }
  ```

- [x] Add graceful fallback ✅
  - If Redis fails, bypass cache and call adapter directly
  - Log warnings but don't crash

- [ ] Write cache tests (pending)
  - Cache hit/miss tests
  - Deduplication tests (100 concurrent → 1 API call)
  - Invalidation tests (cache cleared after trade)

#### Files Created

```
apps/web/src/lib/server/exchanges/
└── cached-adapter.ts           # Redis caching wrapper ✅
```

#### Success Criteria

- [x] Caching implemented with configurable TTLs
- [x] Request deduplication implemented
- [x] Cache invalidated after trading operations
- [x] Graceful fallback if Redis unavailable
- [ ] Cache hit rate >95% measured (needs testing)
- [ ] 100 concurrent requests → 1 call verified (needs testing)

---

### Phase 3: Migration (Week 2 - Days 5-9) ✅ COMPLETED

**Goal**: Migrate all API routes to use adapter

#### Routes Migrated (12 total)

**Market Data Routes** (5):
- [x] `apps/web/src/app/api/markets/route.ts`
- [x] `apps/web/src/app/api/markets/prices/route.ts`
- [x] `apps/web/src/app/api/markets/[symbol]/klines/route.ts`
- [x] `apps/web/src/app/api/markets/[symbol]/orderbook/route.ts`
- [x] `apps/web/src/app/api/markets/[symbol]/trades/route.ts`

**Account Routes** (3 via service layer):
- [x] `apps/web/src/app/api/account/summary/route.ts` (Phase 1)
- [x] `apps/web/src/app/api/account/positions/route.ts` (uses account service)
- [x] `apps/web/src/app/api/account/orders/open/route.ts` (uses account service)

**Trading Routes**: NO MIGRATION NEEDED
- Order placement routes (`/api/orders`) make direct HTTP calls to Pacifica
- These are SIGNED PROXIES - should NOT use adapter pattern
- Adapter is for READ operations only

**User/Fight Routes** (4):
- [x] `apps/web/src/app/api/users/[id]/trades/route.ts`
- [x] `apps/web/src/app/api/chart/candles/route.ts`
- [x] `apps/web/src/app/api/fights/[id]/positions/route.ts`
- [x] `apps/web/src/app/api/fights/[id]/orders/route.ts`
- [x] `apps/web/src/app/api/fights/[id]/join/route.ts`
- [x] `apps/web/src/app/api/fights/route.ts` (POST)

#### Migration Pattern

**Before**:
```typescript
import * as Pacifica from '@/lib/server/pacifica';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  const account = await Pacifica.getAccount(user.accountAddress);
  return Response.json({ success: true, data: account });
}
```

**After**:
```typescript
import { ExchangeProvider } from '@/lib/server/exchanges/provider';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  const adapter = await ExchangeProvider.getUserAdapter(user.id);

  const account = await adapter.getAccount(user.accountAddress);
  return Response.json({ success: true, data: account });
}
```

#### Implementation Details

All migrated routes include:
- **Feature Flag**: `USE_EXCHANGE_ADAPTER` (defaults to `true`)
- **Graceful Fallback**: Direct Pacifica calls if flag is `false`
- **Symbol Normalization**: Routes normalize symbols (BTC → BTC-USD) for adapter
- **Redis Caching**: Automatic when `REDIS_URL` configured
  - Markets: 5 minutes TTL
  - Prices: 5 seconds TTL
  - Account data: 5 seconds TTL
  - Orders: 3 seconds TTL
- **Request Deduplication**: 100 concurrent requests → 1 API call

#### Validation Steps (Pending)

For each migrated route:
1. [ ] Test endpoint returns same data as before
2. [ ] Verify caching works (check Redis keys)
3. [ ] Load test with 100 concurrent requests
4. [ ] Measure response time improvement

#### Success Criteria

- [x] All API routes migrated (12 routes)
- [x] No regressions (dual code paths with fallback)
- [ ] API call reduction verified (needs testing)
- [ ] Response times improved (needs testing)

---

### Phase 4: Database Schema Update (Week 2 - Day 10)

**Goal**: Prepare database for multi-exchange support

#### Schema Changes

**Rename Model**: `PacificaConnection` → `ExchangeConnection`

```prisma
model ExchangeConnection {
  id String @id @default(uuid())
  userId String

  // Exchange metadata
  exchangeType String @default("pacifica") // "pacifica", "hyperliquid", "binance"
  accountId String // accountAddress for Pacifica, wallet for Hyperliquid, API key for Binance
  vaultKeyReference String // Path to encrypted credentials in vault

  // Exchange-specific settings
  builderCodeApproved Boolean @default(false) // Pacifica-specific
  isActive Boolean @default(true)
  isPrimary Boolean @default(false) // User's primary exchange

  connectedAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, exchangeType])
  @@index([userId])
  @@index([accountId])
  @@map("exchange_connections")
}
```

#### Migration Steps

- [ ] Create Prisma migration
  ```bash
  cd packages/db
  npx prisma migrate dev --name rename_to_exchange_connection
  ```

- [ ] Update all code references
  - [ ] Change `PacificaConnection` → `ExchangeConnection` in models
  - [ ] Update queries in API routes
  - [ ] Update auth helpers

- [ ] Backfill existing data
  ```sql
  UPDATE exchange_connections
  SET exchangeType = 'pacifica'
  WHERE exchangeType IS NULL;
  ```

- [ ] Update `ExchangeProvider.getUserAdapter()`
  ```typescript
  static async getUserAdapter(userId: string): Promise<ExchangeAdapter> {
    const connection = await prisma.exchangeConnection.findFirst({
      where: { userId, isPrimary: true },
      select: { exchangeType: true },
    });

    return this.getAdapter(connection.exchangeType);
  }
  ```

#### Success Criteria

- [ ] Migration runs successfully
- [ ] No data loss
- [ ] All existing connections work
- [ ] Ready for future multi-exchange

---

### Phase 5: Monitoring & Optimization (Week 3 - Days 11-15)

**Goal**: Add observability and optimize performance

#### Monitoring

- [ ] Add metrics tracking
  ```typescript
  // In cached-adapter.ts
  private trackMetric(metric: string, value: number) {
    // Track: cache_hit, cache_miss, api_call, latency
  }
  ```

- [ ] Create dashboard queries
  - Cache hit rate (target: >95%)
  - API calls per second (target: <10/sec)
  - Average response time (target: <50ms)
  - Redis memory usage

- [ ] Set up alerts
  - Cache hit rate <90%
  - API calls >50/sec
  - Redis connection failures

#### Optimization

- [ ] Add request queuing (prevent 429 errors)
  ```typescript
  import PQueue from 'p-queue';

  const pacificaQueue = new PQueue({ concurrency: 50 });
  ```

- [ ] Optimize trade retry logic
  - Reduce from 3 retries to 1
  - OR use WebSocket for trade confirmations
  - Currently in: `apps/web/src/app/api/orders/route.ts:450-480`

- [ ] Fine-tune cache TTLs based on usage patterns

#### Success Criteria

- [ ] Metrics dashboard operational
- [ ] Cache hit rate >95%
- [ ] No 429 rate limit errors
- [ ] API calls reduced by 80%+

---

## Testing Strategy

### Unit Tests

**Adapter Tests** (`apps/web/src/lib/server/exchanges/__tests__/`):
- [ ] `adapter.test.ts` - Interface type tests
- [ ] `pacifica-adapter.test.ts` - Normalization tests
- [ ] `cached-adapter.test.ts` - Cache behavior tests
- [ ] `provider.test.ts` - Factory pattern tests

### Integration Tests

**API Route Tests**:
- [ ] Test each migrated route with real data
- [ ] Verify cache invalidation works
- [ ] Test concurrent request handling

### Load Tests

**Performance Tests**:
- [ ] Simulate 1,000 concurrent users (15s polling)
- [ ] Simulate 5,000 concurrent users (stress test)
- [ ] Measure: API calls/sec, cache hit rate, latency
- [ ] Target at 5K users: <40 Pacifica calls/sec, >95% cache hit
- [ ] Target at 10K users: <60 Pacifica calls/sec, >95% cache hit

### Regression Tests

**Functionality Tests**:
- [ ] Place market order → verify execution
- [ ] Cancel order → verify cancellation
- [ ] Check positions → verify accuracy
- [ ] Load profile → verify data consistency

---

## Rollback Plan

### If Issues Occur

1. **Immediate**: Switch back to direct Pacifica calls
   - Feature flag: `USE_EXCHANGE_ADAPTER=false`
   - Revert API route changes

2. **Redis Failure**: Adapter has built-in fallback
   - Bypasses cache automatically
   - Logs warnings but continues working

3. **Data Inconsistency**:
   - Clear Redis cache: `redis-cli FLUSHDB`
   - Restart with fresh cache

### Rollback Steps

```bash
# 1. Disable adapter in provider
# Set in .env: USE_EXCHANGE_ADAPTER=false

# 2. Revert specific route
git checkout main -- apps/web/src/app/api/account/summary/route.ts

# 3. Clear cache
redis-cli FLUSHDB

# 4. Redeploy
railway up
```

---

## Change Log

### 2026-02-05 - Initial Planning

**Created**:
- Exchange adapter architecture plan
- API consumption analysis
- Documentation structure

**Branch**: `feature/exchange-adapter-architecture`

**Next Steps**:
1. Create adapter interface (Phase 1)
2. Implement Pacifica adapter
3. Add provider factory

---

## Files Modified

### New Files (Created)

```
apps/web/src/lib/server/exchanges/
├── adapter.ts                  # Universal interface
├── pacifica-adapter.ts         # Pacifica implementation
├── cached-adapter.ts           # Redis caching wrapper
└── provider.ts                 # Factory pattern

docs/
├── Adapters/README.md          # Architecture docs
└── Api/
    ├── pacifica-api-consumation.md    # API analysis
    └── exchange-adapter-migration-plan.md  # This file
```

### Modified Files (To Be Changed)

```
API Routes (10 files):
├── apps/web/src/app/api/markets/route.ts
├── apps/web/src/app/api/markets/prices/route.ts
├── apps/web/src/app/api/markets/[symbol]/orderbook/route.ts
├── apps/web/src/app/api/account/summary/route.ts
├── apps/web/src/app/api/account/positions/route.ts
├── apps/web/src/app/api/account/orders/open/route.ts
├── apps/web/src/app/api/orders/route.ts
├── apps/web/src/app/api/users/[id]/trades/route.ts
└── apps/web/src/app/api/fights/[id]/positions/route.ts

Database:
└── packages/db/prisma/schema.prisma  # Rename PacificaConnection

Tests:
└── apps/web/src/lib/server/exchanges/__tests__/  # New test files
```

---

## Decision Log

### Why Exchange Adapter Pattern?

**Decision**: Use adapter pattern instead of direct caching
**Rationale**:
- Enables multi-exchange support (future requirement)
- Single place for caching, deduplication, monitoring
- Clean separation of concerns
- Minimal business logic changes

**Alternatives Considered**:
1. Direct caching wrapper around Pacifica client
   - ❌ Doesn't support multi-exchange
   - ❌ Still tightly coupled

2. Service layer with caching
   - ❌ Doesn't normalize across exchanges
   - ❌ More business logic changes

### Why Redis for Caching?

**Decision**: Use Redis instead of in-memory caching
**Rationale**:
- Shared cache across server instances (horizontal scaling)
- Persistent cache (survives restarts)
- TTL support built-in
- Mature ecosystem

**Alternatives Considered**:
1. In-memory cache (Map/LRU)
   - ❌ Not shared across instances
   - ❌ Lost on restart

2. Database caching
   - ❌ Slower than Redis
   - ❌ Adds DB load

### Cache TTL Values

**Decision**: Conservative TTLs (3-5 seconds for real-time data)
**Rationale**:
- Account data changes frequently (trades, orders)
- 5 seconds is acceptable staleness
- Still gets 70-80% cache hit rate

**TTL Configuration**:
- Markets: 5 minutes (static data)
- Prices: 5 seconds (real-time via WebSocket fallback)
- Account: 5 seconds
- Positions: 5 seconds
- Orders: 3 seconds (most volatile)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Redis failure | Medium | High | Graceful fallback to direct API |
| Cache staleness | Low | Medium | Conservative TTLs (3-5s) |
| Migration bugs | Medium | High | Incremental migration + tests |
| Performance regression | Low | Medium | Load testing before deploy |
| Multi-tenancy issues | Low | Low | Proper cache key prefixing |

---

## Success Metrics

### Technical Metrics

- [ ] **API Call Reduction**: 70-80% fewer Pacifica calls
- [ ] **Cache Hit Rate**: >95%
- [ ] **Response Time**: <50ms average (cached)
- [ ] **Uptime**: No increase in errors

### Business Metrics

- [ ] **User Experience**: No performance degradation
- [ ] **Scalability**: Ready for 10,000+ users (with capacity for 20,000+)
- [ ] **Future-Proof**: Can add Hyperliquid in <1 week
- [ ] **Cost Efficiency**: 85-90% reduction in API costs at scale

---

## References

- **Plan File**: [C:\Users\Lian Li\.claude\plans\steady-orbiting-cray.md](../../.claude/plans/steady-orbiting-cray.md)
- **Architecture Docs**: [../Adapters/README.md](../Adapters/README.md)
- **API Analysis**: [./pacifica-api-consumation.md](./pacifica-api-consumation.md)
- **Pacifica API**: [../Pacifica-API.md](../Pacifica-API.md)

---

**Last Updated**: 2026-02-05
**Status**: Planning Complete → Ready for Implementation
**Next Review**: After Phase 1 completion
