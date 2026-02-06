# API Changes Changelog

This file tracks all significant changes to the API layer, integrations, and adapter patterns.

---

## [Unreleased] - Exchange Adapter Pattern

### 2026-02-05 - Planning & Architecture

**Branch**: `feature/exchange-adapter-architecture`

**Summary**: Designed and documented Exchange Adapter pattern to enable multi-exchange support (Pacifica, Hyperliquid, Binance) and implement Redis caching for 85-90% API call reduction, supporting thousands of concurrent users.

#### Added

- **Exchange Adapter Interface** (`apps/web/src/lib/server/exchanges/adapter.ts`)
  - Universal interface for all exchanges
  - Normalized types: `Market`, `Price`, `Account`, `Position`, `Order`, `TradeHistoryItem`
  - Exchange-agnostic request parameters

- **Pacifica Adapter** (`apps/web/src/lib/server/exchanges/pacifica-adapter.ts`)
  - Wraps existing Pacifica API client
  - Symbol normalization (BTC → BTC-USD)
  - Side normalization (bid/ask → BUY/SELL)
  - Order type normalization (market/limit/stop)

- **Cached Adapter Wrapper** (`apps/web/src/lib/server/exchanges/cached-adapter.ts`)
  - Redis caching with configurable TTLs
  - Request deduplication (100 concurrent → 1 API call)
  - Automatic cache invalidation on trading operations
  - Graceful fallback if Redis unavailable

- **Exchange Provider** (`apps/web/src/lib/server/exchanges/provider.ts`)
  - Factory pattern for adapter instantiation
  - Singleton per exchange type
  - Automatic caching wrapper when Redis configured

- **Documentation**
  - [Adapter Architecture Guide](../Adapters/README.md)
  - [Migration Plan](../Adapters/exchange-adapter-migration-plan.md)
  - [API Consumption Analysis](./pacifica-api-consumation.md)

#### Changed

**Planning to migrate** (not yet implemented):
- All API routes from direct Pacifica calls to adapter pattern
- Database schema: `PacificaConnection` → `ExchangeConnection`

#### Performance Impact

**Expected improvements** (based on analysis):

| Metric | Before (5K users) | Before (10K users) | After (10K users) | Improvement |
|--------|-------------------|-------------------|-------------------|-------------|
| API calls/sec | 200-300+ | 400-600+ | 40-60 | **85-90% reduction** |
| Response time (cached) | 500ms | 500ms | 10ms | **50x faster** |
| Cache hit rate | 0% | 0% | >95% | New |
| Horizontal scaling | Broken | Broken | Works | New |

**Cache TTL Configuration**:
- Markets: 5 minutes (static data)
- Prices: 5 seconds (real-time data)
- Account: 5 seconds
- Positions: 5 seconds
- Orders: 3 seconds
- Trade History: 10 seconds

#### Technical Details

**Symbol Normalization**:
```typescript
// Pacifica: "BTC"
// Normalized: "BTC-USD"
```

**Side Normalization**:
```typescript
// Pacifica: "bid" / "ask"
// Normalized: "BUY" / "SELL"
```

**Order Type Normalization**:
```typescript
// Pacifica: "market", "limit", "stop_loss_market"
// Normalized: "MARKET", "LIMIT", "STOP_MARKET"
```

**Cache Key Structure**:
```typescript
`${exchangeName}:${dataType}:${identifier}`
// Example: "pacifica:positions:0x1234..."
```

#### Migration Strategy

**Phase 1** (Week 1): Foundation
- Create adapter interface
- Implement Pacifica adapter
- Create provider factory
- Write tests

**Phase 2** (Week 1): Caching
- Provision Redis
- Implement cached adapter
- Test cache effectiveness
- Verify deduplication

**Phase 3** (Week 2): Migration
- Migrate 10 API routes
- Update database schema
- Load testing
- Verify no regressions

**Phase 4** (Week 3): Monitoring
- Add metrics tracking
- Create dashboard
- Optimize based on metrics
- Document learnings

#### Why This Change?

**Problems Solved**:
1. **Scalability**: Current system would hit rate limits at 5,000 users (200-300 req/sec), completely exceed them at 10,000 users (400-600 req/sec vs 100-200 limit)
2. **Performance**: Every request makes 500ms API call (no caching)
3. **Coupling**: Tightly coupled to Pacifica (can't add other exchanges)
4. **Duplication**: Multiple users requesting same data = duplicate API calls
5. **Horizontal Scaling**: Each server instance multiplies API load instead of distributing it

**Benefits**:
1. **Massive Scale**: Supports 10,000+ users with 85-90% fewer API calls (40-60 req/sec vs 400-600)
2. **Multi-Exchange Ready**: Can add Hyperliquid/Binance in <1 week
3. **Performance**: 50x faster for cached requests (10ms vs 500ms)
4. **Horizontal Scaling**: Shared Redis cache across all instances
5. **Maintainability**: Single place for caching, deduplication, monitoring
6. **Cost Efficiency**: 85-90% reduction in API costs at scale

#### Breaking Changes

**None** - This is a transparent refactor. All API responses remain identical.

#### Dependencies

**New**:
- `ioredis` - Redis client for caching

**Environment Variables**:
- `REDIS_URL` - Redis connection string (optional, enables caching)

#### Testing

**Unit Tests**:
- Adapter interface compliance
- Symbol/side normalization
- Cache hit/miss behavior
- Deduplication logic

**Integration Tests**:
- API route equivalence (adapter vs direct)
- Cache invalidation on trades
- Concurrent request handling

**Load Tests**:
- 1,000 users @ 15s polling interval
- 5,000 users stress test
- Target at 5K: <40 API calls/sec, >95% cache hit
- Target at 10K: <60 API calls/sec, >95% cache hit

#### Future Work

**Hyperliquid Adapter** (Future):
- ECDSA signing (Ethereum wallet)
- Subaccounts instead of builder codes
- Different order types

**Binance Adapter** (Future):
- HMAC-SHA256 signing (API keys)
- VIP fee structure
- Different symbol format (BTCUSDT)

#### References

- [Plan File](../../.claude/plans/steady-orbiting-cray.md)
- [Architecture Docs](../Adapters/README.md)
- [API Analysis](./pacifica-api-consumation.md)
- [Pacifica API](../Pacifica-API.md)

---

## [2026-02-05] - Trade History API

### Added Individual Trade History

**Summary**: Added `/api/users/[id]/trades` endpoint to fetch user's complete trade history from Pacifica API.

#### Added

- **API Endpoint**: `GET /api/users/[id]/trades`
  - Fetches all trades for a user (limit: 1000)
  - Includes external trades (placed outside TFC)
  - Returns normalized trade data

- **Frontend Components**:
  - `TradesHistoryTable.tsx` - Trade history table with sorting/pagination
  - `useUserTrades.ts` - React hook for fetching trades
  - `PerformanceChart.tsx` - Updated to support trades mode

#### Trade Data Structure

```typescript
interface Trade {
  id: string;              // Pacifica history_id
  symbol: string;          // "BTC", "ETH"
  side: string;            // "BUY" or "SELL"
  position: string;        // "open_long", "close_short", etc.
  amount: string;          // Trade size
  price: string;           // Execution price
  fee: string;             // Trading fee (USD)
  pnl: string | null;      // Realized PnL (null for opens)
  leverage: number | null; // Leverage used
  executedAt: string;      // ISO timestamp
}
```

#### Features

- **Sorting**: By date, symbol, side, amount, price, fee, PnL
- **Pagination**: 20 trades per page
- **Formatting**: Matches Pacifica's exact display format
- **Trade Value**: Calculated (size × price)
- **Position Display**: "Open Long", "Close Short", etc.

#### Table Columns

1. Date (with seconds: "Feb 5, 16:39:31")
2. Symbol
3. Side ("Close Short", "Open Long")
4. Size (4 decimals + symbol)
5. Price (3 decimals)
6. Trade Value (calculated)
7. Position (colored badge)
8. Fees ($XX.XX)
9. PnL (+$XX.XX or -$XX.XX)

#### Performance

**Current** (No Caching):
- Every profile load = 1 Pacifica API call
- Response time: ~500ms
- At 1000 users: ~33 req/sec just for trade history

**After Adapter Migration** (Planned):
- Cache TTL: 10 seconds
- Cache hit rate: >90%
- Response time (cached): ~10ms
- At 1000 users: ~3 req/sec

#### Related Files

- `apps/web/src/app/api/users/[id]/trades/route.ts`
- `apps/web/src/hooks/useUserTrades.ts`
- `apps/web/src/components/TradesHistoryTable.tsx`
- `apps/web/src/components/PerformanceChart.tsx`

---

## Previous Changes

_To be migrated from main CHANGELOG.md_

---

**Format**: Keep this file updated with:
1. Date of change
2. What changed (Added/Changed/Removed)
3. Why it changed
4. Performance impact
5. Breaking changes (if any)
6. Related files

**Review**: Monthly review to archive old entries to separate files if needed.
