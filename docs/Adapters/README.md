# Exchange Adapter Architecture

**Last Updated**: 2026-02-05
**Status**: Planning Phase
**Purpose**: Multi-exchange support (Pacifica, Hyperliquid, Binance) + API optimization

---

## Overview

The Exchange Adapter pattern abstracts exchange-specific logic behind a unified interface, enabling:

1. **Multi-Exchange Support**: Add Hyperliquid, Binance, etc. without refactoring business logic
2. **API Optimization**: Single place for Redis caching, request deduplication, rate limiting
3. **Clean Architecture**: Separation of concerns between exchange protocols and business logic

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     API Routes                              │
│  /api/account/summary, /api/orders, /api/markets, etc.     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 ExchangeProvider                            │
│  Factory: getUserAdapter(userId) → ExchangeAdapter          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│             CachedExchangeAdapter (Wrapper)                 │
│  - Redis caching (5s for account data, 5min for markets)   │
│  - Request deduplication (share promises)                   │
│  - Cache invalidation on trading operations                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Exchange-Specific Adapters                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Pacifica   │  │  Hyperliquid │  │   Binance    │    │
│  │   Adapter    │  │   Adapter    │  │   Adapter    │    │
│  │              │  │              │  │              │    │
│  │  Ed25519     │  │   ECDSA      │  │  HMAC-SHA256 │    │
│  │  signing     │  │   signing    │  │  signing     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. ExchangeAdapter Interface

Universal interface that all exchanges must implement.

**Location**: `apps/web/src/lib/server/exchanges/adapter.ts`

**Core Methods**:
- `getMarkets()` - Market info (symbols, leverage, tick sizes)
- `getPrices()` - Current prices for all symbols
- `getAccount(accountId)` - Account balance, equity, fees
- `getPositions(accountId)` - Open positions
- `getOpenOrders(accountId)` - Active orders
- `getTradeHistory(params)` - Historical fills
- `createMarketOrder(auth, params)` - Place market order
- `createLimitOrder(auth, params)` - Place limit order
- `cancelOrder(auth, params)` - Cancel single order
- `cancelAllOrders(auth, params)` - Cancel all orders
- `updateLeverage(auth, symbol, leverage)` - Set leverage

**Normalized Types**:
- `Market`, `Price`, `Account`, `Position`, `Order`, `TradeHistoryItem`
- All use consistent field names across exchanges
- `metadata` field for exchange-specific data

---

### 2. PacificaAdapter

Wraps existing Pacifica API client with normalized interface.

**Location**: `apps/web/src/lib/server/exchanges/pacifica-adapter.ts`

**Key Transformations**:
- Symbol: `BTC` → `BTC-USD`
- Side: `bid`/`ask` → `BUY`/`SELL`
- Order Type: `market`, `limit`, `stop_loss_market` → `MARKET`, `LIMIT`, `STOP_MARKET`
- Time in Force: `GTC`, `IOC`, `ALO` → `GTC`, `IOC`, `POST_ONLY`
- Trade ID: `history_id` (BigInt) → `historyId` (string)

**Authentication**:
- Uses existing Ed25519 signing from `pacifica-signing.ts`
- Requires `AuthContext` with `{ type: 'pacifica', privateKey: string }`

---

### 3. CachedExchangeAdapter

Transparent caching wrapper for any adapter.

**Location**: `apps/web/src/lib/server/exchanges/cached-adapter.ts`

**Features**:

| Data Type | Cache TTL | Deduplication | Invalidation |
|-----------|-----------|---------------|--------------|
| Markets | 5 minutes | No | Never (static) |
| Prices | 5 seconds | No | Never (real-time via WS) |
| Account | 5 seconds | Yes | On trade |
| Positions | 5 seconds | Yes | On trade |
| Orders | 3 seconds | Yes | On trade/cancel |
| Trade History | 10 seconds | No | Never (append-only) |

**Request Deduplication**:
- If 100 users request positions simultaneously → 1 API call
- Shares promise across concurrent requests
- 90%+ reduction during traffic bursts

**Cache Invalidation**:
- After `createMarketOrder()` → invalidate account, positions, orders
- After `cancelOrder()` → invalidate orders
- After `updateLeverage()` → invalidate settings

---

### 4. ExchangeProvider

Factory for getting the right adapter for a user.

**Location**: `apps/web/src/lib/server/exchanges/provider.ts`

**Usage**:
```typescript
// Get adapter for specific exchange
const adapter = ExchangeProvider.getAdapter('pacifica');

// Get adapter for user (queries database to find their exchange)
const adapter = await ExchangeProvider.getUserAdapter(userId);

// Adapter is automatically wrapped with caching if REDIS_URL is set
```

**Singleton Pattern**:
- Each exchange adapter is created once and cached
- CachedExchangeAdapter wraps it automatically if Redis configured

---

## Data Flow Example

### Example: User Loads Profile

```typescript
// 1. API Route
export async function GET(request: Request) {
  const user = await getAuthUser(request);
  const adapter = await ExchangeProvider.getUserAdapter(user.id);

  // 2. Request goes through CachedExchangeAdapter
  const account = await adapter.getAccount(user.accountAddress);

  return Response.json({ success: true, data: account });
}
```

**Flow**:
1. Check Redis cache: `pacifica:account:{accountAddress}`
2. **Cache HIT** → Return cached data (5s TTL)
3. **Cache MISS** → Check if request in flight (deduplication)
4. If not in flight → Call PacificaAdapter
5. PacificaAdapter → Call Pacifica API
6. Store result in Redis with 5s TTL
7. Return normalized `Account` type

**Performance**:
- First request: ~500ms (API call)
- Subsequent requests within 5s: ~10ms (Redis hit)
- 100 concurrent requests: 1 API call + 99 Redis hits

---

## Exchange-Specific Details

### Pacifica

**Authentication**: Ed25519 signature (Base58)
- Private key stored in vault
- Sign request with `PacificaSigning.signRequest()`
- Builder code required on all orders

**Quirks**:
- Symbols: No suffix (`BTC` not `BTC-USD`)
- Side: `bid`/`ask` instead of `LONG`/`SHORT`
- Time in Force: Has `ALO` and `TOB` (other exchanges don't)
- TP/SL: Separate orders with specific types
- Trade ID: `history_id` is BigInt, unique per fill

**API Specifics**:
- Base URL: `https://api.pacifica.fi`
- Header: `PF-API-KEY` for rate limit increase
- Rate Limiting: ~100-200 req/sec
- WebSocket: Available for prices, positions, orders

---

### Hyperliquid (Future)

**Authentication**: ECDSA signature (Ethereum wallet)
- Private key: Hex-encoded (not Base58)
- Sign with `ethers.Wallet.signMessage()`
- Subaccounts instead of builder codes

**Quirks**:
- Symbols: Native format varies
- Side: `"A"` = ask, `"B"` = bid
- Time in Force: Only `GTC` and `IOC` (no `ALO`/`TOB`/`FOK`)
- TP/SL: Can attach to position or create as separate orders
- Trade ID: Different structure

**API Specifics**:
- Base URL: `https://api.hyperliquid.xyz`
- WebSocket-heavy architecture
- Different endpoint structure (`/info`, `/exchange`)

---

### Binance (Future)

**Authentication**: HMAC-SHA256 (API key + secret)
- Not wallet-based (uses API keys)
- Sign with `crypto.createHmac('sha256', secret)`
- Different fee structure (VIP levels)

**Quirks**:
- Symbols: `BTCUSDT` format
- Side: `BUY`/`SELL` (same as normalized)
- Time in Force: Has `FOK` (fill or kill)
- TP/SL: Can attach to order or create separately
- Trade ID: Numeric, incremental

**API Specifics**:
- Base URL: `https://fapi.binance.com` (futures)
- RESTful (less WebSocket dependency)
- Strict timestamp requirements (5s clock sync)

---

## Normalized Type Reference

### Market

```typescript
interface Market {
  symbol: string;           // "BTC-USD", "ETH-USD"
  baseAsset: string;        // "BTC", "ETH"
  quoteAsset: string;       // "USD", "USDT"
  tickSize: string;         // Minimum price increment
  stepSize: string;         // Minimum quantity increment
  minOrderSize: string;     // Minimum order size
  maxOrderSize: string;     // Maximum order size
  minNotional: string;      // Minimum order value
  maxLeverage: number;      // Maximum leverage
  fundingRate: string;      // Current funding rate
  fundingInterval: number;  // Funding interval (hours)
  metadata: Record<string, unknown>; // Exchange-specific
}
```

---

### Price

```typescript
interface Price {
  symbol: string;      // "BTC-USD"
  mark: string;        // Mark price for PnL
  index: string;       // Index price (oracle)
  last: string;        // Last traded price
  bid: string;         // Best bid
  ask: string;         // Best ask
  funding: string;     // Current funding rate
  volume24h: string;   // 24h volume
  change24h: string;   // 24h price change %
  timestamp: number;   // Epoch milliseconds
}
```

---

### Account

```typescript
interface Account {
  accountId: string;          // Exchange account identifier
  balance: string;            // Total balance (USD)
  accountEquity: string;      // Equity including unrealized PnL
  availableToSpend: string;   // Available for new positions
  marginUsed: string;         // Margin locked in positions
  unrealizedPnl: string;      // Unrealized PnL
  makerFee: string;           // Maker fee rate (0.0002 = 0.02%)
  takerFee: string;           // Taker fee rate
  metadata: Record<string, unknown>;
}
```

---

### Position

```typescript
interface Position {
  symbol: string;           // "BTC-USD"
  side: 'LONG' | 'SHORT';  // Position side
  amount: string;           // Position size
  entryPrice: string;       // Average entry price
  markPrice: string;        // Current mark price
  margin: string;           // Margin allocated
  leverage: string;         // Actual leverage used
  unrealizedPnl: string;    // Unrealized PnL
  liquidationPrice: string; // Liquidation price
  funding: string;          // Cumulative funding
  metadata: Record<string, unknown>;
}
```

---

### Order

```typescript
type OrderSide = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT' | 'TAKE_PROFIT_MARKET' | 'TAKE_PROFIT_LIMIT';
type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'POST_ONLY';

interface Order {
  orderId: string | number;  // Exchange order ID
  clientOrderId?: string;    // Client-provided order ID
  symbol: string;            // "BTC-USD"
  side: OrderSide;           // "BUY" or "SELL"
  type: OrderType;           // Order type
  price: string;             // Limit price (empty for market)
  amount: string;            // Order size
  filled: string;            // Filled amount
  remaining: string;         // Remaining amount
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  timeInForce: TimeInForce;
  reduceOnly: boolean;       // Position close only
  createdAt: number;         // Epoch milliseconds
  updatedAt: number;
  metadata: Record<string, unknown>;
}
```

---

### TradeHistoryItem

```typescript
interface TradeHistoryItem {
  historyId: string;       // Unique fill ID
  orderId: string | number; // Order that generated this fill
  symbol: string;           // "BTC-USD"
  side: 'BUY' | 'SELL';    // Fill side
  amount: string;           // Fill size
  price: string;            // Fill price
  fee: string;              // Trading fee (USD)
  pnl: string | null;       // Realized PnL (null for opens)
  executedAt: number;       // Fill timestamp (epoch ms)
  metadata: Record<string, unknown>;
}
```

---

## Migration Guide

### Step 1: Update API Route

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

**Benefits**:
✅ Caching added automatically (5s TTL)
✅ Deduplication added automatically
✅ Ready for Hyperliquid/Binance (just update `getUserAdapter` logic)
✅ Zero business logic changes

---

### Step 2: Update Trading Operations

**Before**:
```typescript
import * as Pacifica from '@/lib/server/pacifica';
import * as PacificaSigning from '@/lib/server/pacifica-signing';

const keypair = PacificaSigning.keypairFromPrivateKey(privateKey);
const result = await Pacifica.createMarketOrder(keypair, {
  symbol: 'BTC',
  amount: '0.1',
  side: 'bid',
  builderCode: 'TradeClub',
});
```

**After**:
```typescript
import { ExchangeProvider } from '@/lib/server/exchanges/provider';

const adapter = await ExchangeProvider.getUserAdapter(userId);
const result = await adapter.createMarketOrder(
  {
    accountId: user.accountAddress,
    credentials: { type: 'pacifica', privateKey },
  },
  {
    symbol: 'BTC-USD',
    side: 'BUY',
    amount: '0.1',
  }
);
```

**Benefits**:
✅ Normalized parameters (symbol, side)
✅ Cache invalidation automatic
✅ Exchange-agnostic code

---

## Performance Impact

### Before Adapter Pattern

| Metric | 250 Users | 5,000 Users | 10,000 Users |
|--------|-----------|-------------|--------------|
| Peak API calls/sec | 20-35 | 200-300+ | 400-600+ |
| Cache hit rate | 0% | 0% | 0% |
| Deduplication | None | None | None |
| Rate limit risk | MEDIUM | CRITICAL | CRITICAL |

### After Adapter Pattern

| Metric | 5,000 Users | 10,000 Users | 20,000 Users |
|--------|-------------|--------------|--------------|
| Peak API calls/sec | 30-40 | 40-60 | 80-120 |
| Cache hit rate | >95% | >95% | >95% |
| Deduplication | 90%+ on bursts | 90%+ on bursts | 90%+ on bursts |
| Rate limit risk | LOW | LOW | MEDIUM* |

*At 20,000+ users, consider multiple API keys or dedicated infrastructure

**Expected Improvements**:
- **80-90% reduction** in API calls (via caching)
- **90%+ reduction** during burst traffic (via deduplication)
- **50x faster** responses for cached data (10ms vs 500ms)
- **Scales horizontally** - shared Redis cache across all instances

---

## Testing Strategy

### Test 1: Adapter Equivalence
Verify that adapter returns same data as direct Pacifica calls.

```typescript
// Direct call
const direct = await Pacifica.getAccount(accountAddress);

// Via adapter
const adapter = ExchangeProvider.getAdapter('pacifica');
const viaAdapter = await adapter.getAccount(accountAddress);

// Verify equivalence (accounting for normalization)
expect(viaAdapter.balance).toBe(direct.balance);
expect(viaAdapter.accountEquity).toBe(direct.account_equity);
```

---

### Test 2: Cache Effectiveness
Verify that cache reduces API calls.

```typescript
// Make 100 concurrent requests
const promises = Array.from({ length: 100 }, () =>
  adapter.getPositions(accountAddress)
);

const results = await Promise.all(promises);

// Verify only 1 Pacifica API call was made
expect(pacificaApiCallCount).toBe(1);

// Verify all results are identical
expect(results.every(r => r === results[0])).toBe(true);
```

---

### Test 3: Cache Invalidation
Verify that trading operations invalidate cache.

```typescript
// 1. Fetch positions (cache miss)
const before = await adapter.getPositions(accountAddress);

// 2. Place order
await adapter.createMarketOrder(auth, {
  symbol: 'BTC-USD',
  side: 'BUY',
  amount: '0.1',
});

// 3. Fetch positions again (should be fresh data)
const after = await adapter.getPositions(accountAddress);

// Verify cache was invalidated (new API call made)
expect(pacificaApiCallCount).toBe(2);
```

---

## File Structure

```
apps/web/src/lib/server/exchanges/
├── adapter.ts                  # Core interface + normalized types
├── pacifica-adapter.ts         # Pacifica implementation
├── hyperliquid-adapter.ts      # Hyperliquid implementation (future)
├── binance-adapter.ts          # Binance implementation (future)
├── cached-adapter.ts           # Redis caching wrapper
└── provider.ts                 # Factory for getting adapters

docs/Adapters/
├── README.md                   # This file
├── pacifica-adapter-guide.md   # Pacifica-specific details
├── hyperliquid-adapter-guide.md # Hyperliquid implementation guide
└── binance-adapter-guide.md    # Binance implementation guide
```

---

## Next Steps

### Phase 1: Foundation (Week 1)
1. Create adapter interface (`adapter.ts`)
2. Implement Pacifica adapter (`pacifica-adapter.ts`)
3. Create provider factory (`provider.ts`)
4. Write tests for equivalence
5. Migrate 1-2 API routes as proof of concept

### Phase 2: Caching (Week 1)
6. Provision Redis instance (Upstash/AWS ElastiCache)
7. Implement `CachedExchangeAdapter`
8. Test cache hit rates (target: >95%)
9. Verify cache invalidation works

### Phase 3: Full Migration (Week 2)
10. Migrate all API routes to use adapter
11. Update database schema (rename `PacificaConnection` → `ExchangeConnection`)
12. Load test with simulated 1000 users
13. Monitor API call reduction

### Phase 4: Hyperliquid (Future)
14. Implement `HyperliquidAdapter`
15. Add Hyperliquid connection flow
16. Test with real Hyperliquid account

### Phase 5: Binance (Future)
17. Implement `BinanceAdapter`
18. Add Binance API key management
19. Test with real Binance account

---

## FAQ

### Q: Will the adapter add latency?

**A**: Minimal. The adapter is a thin wrapper (~10ms overhead for transformations). The caching layer actually **reduces** latency (10ms cached vs 500ms API call).

---

### Q: What happens if Redis fails?

**A**: The `CachedExchangeAdapter` has graceful fallback. If Redis is unavailable, it bypasses the cache and calls the underlying adapter directly. Users experience no downtime.

---

### Q: How do we handle exchange-specific features?

**A**: Two approaches:
1. **Optional methods**: `approveBuilderCode?()` is Pacifica-specific (marked with `?`)
2. **Metadata field**: Each type has `metadata: Record<string, unknown>` for exchange-specific data

---

### Q: Can users have accounts on multiple exchanges?

**A**: Yes! The database schema supports multiple `ExchangeConnection` per user with `isPrimary` flag. The provider returns the primary exchange adapter by default.

---

### Q: How does this affect fight settlement?

**A**: Fight settlement uses cached positions/trades from the adapter. Since cache TTL is 5 seconds and fights are minutes/hours long, this is negligible. If needed, we can bypass cache for fight settlement.

---

## References

- **API Optimization Analysis**: [pacifica-api-consumation.md](../Api/pacifica-api-consumation.md)
- **Pacifica API Docs**: Internal notes at [pacifica-api-consumation.md](../Api/pacifica-api-consumation.md)
- **Implementation Plan**: [C:\Users\Lian Li\.claude\plans\steady-orbiting-cray.md](../../.claude/plans/steady-orbiting-cray.md)

---

**Last Updated**: 2026-02-05
**Status**: Ready for implementation
**Estimated Effort**: 3-4 weeks
**Expected Impact**: 80-90% API reduction + multi-exchange support
