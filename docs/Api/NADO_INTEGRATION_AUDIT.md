# Nado DEX Integration — Full Technical Audit

> **Date:** 2026-02-25
> **Scope:** Backend adapter, order router, WebSocket adapter, API routes, frontend integration, auth flow
> **Method:** Line-by-line code review vs. Nado API documentation, cross-referenced against Pacifica and Hyperliquid reference implementations
> **Files inspected:** 25+ files across `apps/web`, `packages/shared`, `packages/db`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Comparison (Pacifica vs HL vs Nado)](#2-architecture-comparison)
3. [Feature-by-Feature Audit](#3-feature-by-feature-audit)
   - 3.1 [Chart Candle Data](#31-chart-candle-data)
   - 3.2 [Price Feeds](#32-price-feeds)
   - 3.3 [Order Book](#33-order-book)
   - 3.4 [Positions](#34-positions)
   - 3.5 [Open Orders](#35-open-orders)
   - 3.6 [Trade History](#36-trade-history)
   - 3.7 [Order History](#37-order-history)
   - 3.8 [Order Types](#38-order-types)
   - 3.9 [Builder Code](#39-builder-code)
   - 3.10 [Deposit & Withdrawal](#310-deposit--withdrawal)
   - 3.11 [Authentication Flow](#311-authentication-flow)
   - 3.12 [Rate Limiting](#312-rate-limiting)
   - 3.13 [Error Handling](#313-error-handling)
4. [Critical Bugs](#4-critical-bugs)
5. [Code Quality Issues](#5-code-quality-issues)
6. [Performance Risks](#6-performance-risks)
7. [Security Risks](#7-security-risks)
8. [Refactoring Recommendations](#8-refactoring-recommendations)
9. [Structured Action Plan](#9-structured-action-plan)

---

## 1. Executive Summary

The Nado integration is **functionally operational** — orders can be placed, positions displayed, prices streamed, and charts rendered. However, the implementation has **4 critical bugs, 8 high-severity issues, 22 medium-severity issues**, and numerous code quality concerns that would cause failures in production.

### Completeness Scorecard

| Feature | Status | Score |
|---------|--------|-------|
| Chart candle data (historical + realtime) | Working with gaps | 80% |
| Price feeds (WS real-time) | Working | 85% |
| Order book (depth + updates) | Working, no desync detection | 70% |
| Positions | Working, missing leverage/margin/liqPrice | 65% |
| Open orders | Working, slow (N serial requests) | 70% |
| Trade history | Working, wrong timestamps | 75% |
| Order history | Working | 80% |
| Order types (market, limit, stop, TP/SL) | Working | 85% |
| Builder code | Wired, awaiting registration | 95% |
| Deposit & withdrawal | Withdraw implemented, deposit missing | 40% |
| Authentication (linked signer) | Working, no key rotation | 75% |
| Rate limiting | Partial (gateway only, archive unprotected) | 50% |
| Error handling | Inconsistent across layers | 45% |
| WebSocket reconnection | Working | 85% |
| WS authentication (private streams) | Not implemented | 0% |
| Frontend exchange abstraction | Broken by `-USD` → `-PERP` mismatch | 40% |

### What's Good

- **EIP-712 signing** — correctly implemented with proper domain, types, and linked signer flow
- **x18 encoding** — `toX18`/`fromX18` work correctly for typical trading ranges
- **Builder code** — properly encoded in appendix with env var configuration
- **WebSocket architecture** — BBO-based real-time prices, incremental orderbook, candle streaming
- **Reconnection logic** — auto-reconnect with subscription recovery matches HL/Pacifica pattern
- **Multi-consumer callbacks** — `callbackSets` pattern allows multiple UI consumers

### What's Broken

- **Symbol format mismatch** — Nado uses `BTC-PERP`, TFC uses `BTC-USD`. 35 instances of `.replace('-USD', '')` in `page.tsx` silently fail for Nado symbols
- **Fight stake enforcement** — `stake-info` route hardcodes Pacifica API, ignoring HL/Nado positions
- **Stop order cancellation** — routes to Gateway instead of Trigger service
- **Auth flow key orphaning** — repeated POST to `/setup` generates new keys without revoking old linked signers
- **Account UI hidden** — deposit/withdraw buttons and account stats panel only show for Pacifica

---

## 2. Architecture Comparison

### How Each Exchange Is Implemented

| Aspect | Pacifica | Hyperliquid | Nado |
|--------|----------|-------------|------|
| **Signing** | Client-side (Ed25519/Solana) | Server-side (EIP-712 agent wallet) | Server-side (EIP-712 linked signer) |
| **Auth model** | Solana wallet signature | EVM wallet + one-time agent approval | EVM wallet + one-time link_signer |
| **REST API style** | Multiple GET/POST endpoints | Single POST `/info` with `{ type }` | POST `/query` (Gateway) + POST (Archive) |
| **WS prices** | Native `prices` stream (all markets) | `allMids` stream (all markets) | Per-product `best_bid_offer` subscription |
| **WS orderbook** | Full snapshots | Full snapshots | **Incremental diffs** (requires local state) |
| **WS candles** | Native `candle` stream | REST polling (5s) | Native `latest_candlestick` stream |
| **WS positions** | Native `account_positions` stream | REST-on-WS-event (poll on fill) | REST-on-WS-event + `position_change` stream |
| **WS orders** | Native `account_orders` stream | REST fallback (no trigger metadata) | **Not implemented** (requires WS auth) |
| **WS authentication** | Not needed (public streams) | Not needed (address-based) | **Required for `order_update`** (EIP-712 StreamAuthentication) |
| **Number format** | Normal floats | Normal floats | **x18 fixed-point** (BigInt math) |
| **Symbol format** | `BTC` / `BTC-USD` | `BTC` / `BTC-USD` | **`BTC-PERP`** |
| **Order ID** | Numeric string | Numeric string | **Hex digest (bytes32)** |
| **Rate limiting** | Standard HTTP 429 | Serial queue (100ms gap) | Serial queue (50ms gap, gateway only) |
| **Caching** | Redis (CachedExchangeAdapter) | Module-level singleton | Module-level singleton (**no refresh**) |
| **Builder code** | `PACIFICA_BUILDER_CODE` string | `HYPERLIQUID_BUILDER_ADDRESS` + fee | `NADO_BUILDER_ID` + `NADO_BUILDER_FEE_RATE` in appendix bits |
| **TP/SL** | Native API endpoint | `positionTpsl` grouping | Separate Trigger service |
| **Stop orders** | Native API endpoint | Trigger orders via main API | Separate Trigger service URL |

### Key Architectural Gaps in Nado vs Reference

1. **No WS authentication** — Pacifica/HL don't need it. Nado requires signed `StreamAuthentication` for `order_update`. This means real-time order status updates are missing.
2. **Incremental orderbook without desync protection** — Pacifica/HL send full snapshots. Nado sends diffs. No sequence number validation exists.
3. **Per-product subscriptions vs. all-market streams** — Pacifica/HL have single streams for all prices. Nado requires subscribing to each product individually, creating N subscriptions.
4. **Product cache never refreshes** — Pacifica has Redis caching with TTLs. HL refreshes metadata every 30s. Nado's product cache loads once and never updates.
5. **Archive API has no rate limiting** — Gateway uses serial queue. Archive requests fire with no throttling.

---

## 3. Feature-by-Feature Audit

### 3.1 Chart Candle Data

**Historical (REST):** `nado-adapter.ts` → `getKlines()` (lines 550-615)

| Aspect | Status | Notes |
|--------|--------|-------|
| Archive `candlesticks` endpoint | Correct | Proper x18 decoding, correct granularity mapping |
| Granularity mapping | Correct | Maps TFC intervals (1m, 5m, etc.) to seconds |
| Time range handling | Correct | Uses `max_time` + `limit` parameters |
| Fallback to Binance/Bybit/CoinGecko | Working | `chart/candles/route.ts` handles `-PERP` → `-USD` mapping (line 67-80) |
| Gap filling | Working | Synthetic candles with `close=prevClose, volume=0` |
| Volume encoding | **Possible issue** | Archive volume is in base units (x18). `fromX18(c.volume)` gives base quantity, but TFC expects USD volume. The chart may show volume in BTC instead of USD. |

**Real-time (WebSocket):** `nado-ws-adapter.ts` → `latest_candlestick` stream

| Aspect | Status | Notes |
|--------|--------|-------|
| Subscription | Correct | Per-product + per-granularity |
| OHLCV mapping | Correct | x18 decode for all fields |
| Timestamp | **Missing** | `latest_candlestick` events don't include `timestamp`. The adapter constructs time from current `Date.now()`. |
| Multi-resolution | Working | Separate subscriptions per granularity |

**Comparison to reference:**
- Pacifica: Native `candle` WS stream with proper timestamps
- Hyperliquid: REST polling every 5 seconds (no WS candles)
- Nado: Native WS stream — **better than HL**, similar to Pacifica

### 3.2 Price Feeds

**Implementation:** `nado-ws-adapter.ts` → `best_bid_offer` + `funding_rate` + `funding_payment` streams

| Aspect | Status | Notes |
|--------|--------|-------|
| Real-time prices | **Working** | BBO mid as primary price via WebSocket |
| Oracle price | Working | From `all_products` query on initial load |
| Index price | Working | From `perp_prices` archive endpoint (30s refresh) |
| Mark price | **Not available via WS** | Only from archive `perp_prices` (30s refresh) |
| 24h change | Working | Hourly candles (rolling 24h window) |
| 24h volume | Working | From `market_snapshots` archive |
| Open interest | Working | From `market_snapshots` archive |
| Funding rate | Working | `funding_rate` WS stream (~20s updates) |
| Max leverage | Working | Derived from `long_weight_initial_x18` |
| Tick size / Lot size | Working | From product metadata |
| 24h high/low | **Fake fallback** | `livePx * 1.02` / `livePx * 0.98` when stats not loaded |

**Issue: `emitPrices` called too frequently (P2)**

Every `best_bid_offer` message triggers a full `emitPrices()` rebuild of ALL products. With 20+ products, each emitting BBO at ~50ms intervals, this creates ~400 callback invocations per second. Should debounce to 100-200ms.

**Issue: 24h high/low are fabricated (P3)**

When `fetchMarketStats` hasn't completed, `high24h` and `low24h` use `±2%` of current price. This is shown to users as real data. Should display `0` or `—` instead.

**Comparison to reference:**
- Pacifica: All prices in single `prices` WS stream, including funding and OI
- Hyperliquid: `allMids` for prices, REST for volume/OI/funding (30s refresh)
- Nado: Per-product BBO via WS + REST for stats — **hybrid approach, functionally equivalent to HL**

### 3.3 Order Book

**Implementation:** `nado-ws-adapter.ts` → REST snapshot + `book_depth` WS diffs

| Aspect | Status | Notes |
|--------|--------|-------|
| Initial snapshot | Working | `market_liquidity` query with `depth: 50` |
| Incremental updates | Working | `book_depth` diffs applied to local Map |
| Quantity = 0 removal | Working | Correctly removes price levels |
| x18 decoding | Correct | Both price and quantity |
| Aggregation levels | **Not implemented** | Pacifica/HL support configurable aggregation. Nado's `market_liquidity` doesn't have an `agg_level` param. |

**Issue: No desync detection (P1)**

```
Risk: If any WS message is lost (network blip during reconnect), the orderbook becomes
permanently wrong. There is no sequence number, no periodic re-sync, no checksum.
```

**Recommended fix:**
1. Store the last snapshot timestamp
2. Re-fetch snapshot every 30-60 seconds
3. Compare WS data freshness against snapshot

**Comparison to reference:**
- Pacifica: Full snapshots every update — simple, no desync possible
- Hyperliquid: Full snapshots every update — same
- Nado: Incremental diffs — **more efficient but requires desync protection**

### 3.4 Positions

**Backend:** `nado-adapter.ts` → `getPositions()` (lines 698-752)

| Field | Status | Notes |
|-------|--------|-------|
| symbol | Correct | From product cache |
| side (LONG/SHORT) | Correct | Derived from `amount` sign |
| size | Correct | `abs(fromX18(amount))` |
| entryPrice | Correct | `-vQuoteBalance / amount` |
| markPrice | **Hardcoded '0'** | Not fetched — should come from `oracle_price_x18` or `perp_prices` |
| unrealizedPnl | Correct | From product state data |
| margin | **Hardcoded '0'** | Not calculated |
| leverage | **Hardcoded '1'** | Should derive from position notional / margin |
| liquidationPrice | **Hardcoded '0'** | Not calculated |
| fundingPnl | **Partially correct** | Uses correct cumulative funding direction (long vs short) |

**WebSocket positions:** `position_change` stream

| Aspect | Status | Notes |
|--------|--------|-------|
| Real-time updates | Working | `position_change` events + REST on fills |
| Full position set | **Broken** | `position_change` emits single position, not full set |
| REST fallback | Working | `fetchAndEmitPositions` on fill events |

**Missing data compared to reference:**

Pacifica positions include: `margin`, `liq_price`, `leverage`, `mark_price`, `unrealized_pnl`, all from API.
Hyperliquid positions include: `leverage`, `liquidationPx`, `marginUsed`, `returnOnEquity`, from `clearinghouseState`.
Nado positions: Must be **calculated client-side** from health data, which is available in `subaccount_info` response but not used.

**Recommended fix:**
1. Use `healths` from `subaccount_info` to calculate margin and liquidation
2. Use `oracle_price_x18` from `all_products` as markPrice
3. On `position_change`, call `fetchAndEmitPositions()` for the full set (don't emit partial)

### 3.5 Open Orders

**Backend:** `nado-adapter.ts` → `getOpenOrders()` (lines 757-828)

| Aspect | Status | Notes |
|--------|--------|-------|
| Fetches all products | Working | Parallel queries per perp product |
| Order type decoding | **Partial** | Decodes from appendix bits, but only `DEFAULT/IOC/FOK/POST_ONLY` |
| Trigger orders | **Not fetched** | `list_trigger_orders` requires signature — not implemented |
| Order mapping | Correct | Symbol, side, price, amount, filled all correct |

**Issue: N serial requests for open orders (P2)**

```typescript
// Line 757: One query per product, serialized through 50ms queue
const results = await Promise.all(perpProducts.map(p => nadoQuery({
  type: 'subaccount_orders', sender: subaccount, product_id: p.productId
}).catch(() => ...)));
```

With 20+ products and 50ms gap: **1+ second minimum** to fetch all open orders. Pacifica and HL both use a single API call.

**WebSocket orders:** NOT IMPLEMENTED

```typescript
// nado-ws-adapter.ts line 1418:
// TODO: order_update requires authentication (EIP-712 StreamAuthentication)
```

Orders are only refreshed via REST polling, triggered by fill events or explicit refresh. This is a significant gap — users don't see order status changes (placed, partially filled, cancelled) in real-time.

**Recommended fix:**
1. Implement WS `StreamAuthentication` for `order_update` stream
2. Check if Nado has a "all open orders for subaccount" endpoint (no per-product iteration)

### 3.6 Trade History

**Backend:** `nado-adapter.ts` → `getTradeHistory()` (lines 831-880)

| Aspect | Status | Notes |
|--------|--------|-------|
| Archive `matches` endpoint | Correct | Proper request format |
| Fill mapping | Correct | Price, amount, fee, side all mapped |
| **executedAt** | **WRONG** | Always `Date.now()` instead of actual execution time |
| Fee includes builder fee | **Unclear** | Nado returns `fee` + `builder_fee` separately. Adapter uses `fee` only. |
| Pagination | Working | Uses `limit` parameter |

**Issue: Trade timestamps are always current time (P1)**

```typescript
// nado-adapter.ts line 864:
executedAt: Date.now(), // Timestamp comes from txs, not individual matches
```

This means all trade history items show as "just now" regardless of when they actually happened. The `submission_idx` field from Nado could be used as an ordering key, but actual timestamps need to come from the `orders` endpoint which has `first_fill_timestamp` and `last_fill_timestamp`.

**Recommended fix:** Use `matches` endpoint's associated `submission_idx` to fetch timestamps from `orders` endpoint, or use the `orders` endpoint directly for trade history (it includes `base_filled`, `quote_filled`, `fee`, `realized_pnl`, and timestamps).

### 3.7 Order History

**Backend:** `nado-adapter.ts` → `getOrderHistory()` (lines 882-940)

| Aspect | Status | Notes |
|--------|--------|-------|
| Archive `orders` endpoint | Correct | |
| Status mapping | **Partial** | All non-fully-filled orders mapped as `'canceled'` |
| Timestamp | **Correct** | Uses `first_fill_timestamp` from archive |
| Filled amount | Correct | Calculated from `base_filled` |

**Issue: Order status is binary (P3)**

```typescript
// Line 923:
const status: OrderHistoryStatus = isFullyFilled ? 'filled' : 'canceled';
```

Orders that are partially filled then expired should show `'partially_filled'`, not `'canceled'`. The appendix encodes expiration info that could differentiate these states.

### 3.8 Order Types

| Order Type | Status | Notes |
|------------|--------|-------|
| Market (IOC at slippage price) | **Working** | 5% default slippage, 60s expiration |
| Limit (GTC) | **Working** | 30-day expiration |
| Limit (IOC) | **Working** | Appendix correctly set |
| Limit (FOK) | **Working** | Appendix correctly set |
| Limit (POST_ONLY) | **Working** | Appendix correctly set |
| Reduce-Only | **Working** | Appendix reduce_only bit set |
| Stop Market | **Working** | Via Trigger service, `priceX18='0'` |
| Stop Limit | **Working** | Via Trigger service, limit price set |
| TP (Take Profit) | **Working** | Via Trigger service, reduce-only + IOC |
| SL (Stop Loss) | **Working** | Via Trigger service, reduce-only + IOC |
| Edit Order | **Broken** | Cancel+replace, defaults side to 'BUY' |
| Batch Orders | **Working** | Sequential (no native batch endpoint) |
| TWAP | **Not implemented** | Nado supports TWAP via trigger service |
| Isolated Margin | **Not implemented** | Appendix `isolated` bit exists but never set |

**Issue: Edit order defaults to BUY (P1)**

```typescript
// nado-order-router.ts line 524:
const side = (params as unknown as { side?: string }).side || 'BUY';
```

If frontend doesn't pass `side`, replacement order is always BUY. Could flip a user's position direction.

**Issue: No price/size rounding (P2)**

Neither `createOrder` nor `createStopOrder` round price to `price_increment_x18` or amount to `size_increment`. Nado will reject orders with invalid tick/lot sizes. Pacifica handles this server-side. Hyperliquid has `roundToHlTick()` and `floatToWire()` that enforce rounding.

**Recommended fix:** Add rounding helpers similar to HL:
```typescript
function roundToNadoTick(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}
function roundToNadoLot(amount: number, lotSize: number): number {
  return Math.round(amount / lotSize) * lotSize;
}
```

### 3.9 Builder Code

| Aspect | Status | Notes |
|--------|--------|-------|
| `encodeAppendix` builder bits | **Correct** | Fee at bits 38-47, ID at bits 48-63 |
| Env var configuration | **Correct** | `NADO_BUILDER_ID`, `NADO_BUILDER_FEE_RATE` |
| Auto-inclusion in all orders | **Correct** | `encodeAppendix` falls back to env vars |
| Bit masking | **Correct** | `& 0x3FF` for fee (10 bits), `& 0xFFFF` for ID (16 bits) |
| Fee claiming (on-chain) | **Not implemented** | `ClaimBuilderFee` transaction type 31 |
| `.env` setup | **Done** | `NADO_BUILDER_ID=0`, `NADO_BUILDER_FEE_RATE=10` |

**Builder code is the most complete feature.** Only missing the fee claiming mechanism (on-chain tx), which is a separate operational task.

### 3.10 Deposit & Withdrawal

| Aspect | Status | Notes |
|--------|--------|-------|
| **Withdraw** | Working | `withdraw_collateral` with 6-decimal USDT0 amount |
| **Deposit** | **Not implemented** | On-chain USDT0 transfer to Nado contract |
| **max_withdrawable check** | **Not implemented** | Should query before withdrawal |
| **UI deposit button** | **Hidden** | `pacificaConnected` gate hides it for Nado |
| **UI withdraw button** | **Hidden** | Same gate |

**Comparison:**
- Pacifica: Deposit/Withdraw via API + UI buttons
- Hyperliquid: Withdraw via API, Deposit via Bridge2 contract + UI
- Nado: Only withdraw via API, no UI, no deposit flow

**Recommended fix:**
1. Add "Deposit on Nado" button linking to `exchangeConfig.depositUrl`
2. Show withdraw button for all exchanges (not just Pacifica)
3. Add `max_withdrawable` pre-check before withdrawal

### 3.11 Authentication Flow

| Aspect | Status | Notes |
|--------|--------|-------|
| Key generation | Working | `Wallet.createRandom()` encrypted with AES-256-GCM |
| EIP-712 LinkSigner | Working | Correct domain, type, nonce |
| Signature submission | Working | POST to Gateway `/execute` |
| DB upsert | Working | `ExchangeConnection` with `agentApproved` flag |
| Key rotation | **Not implemented** | POST always generates new key, no revocation |
| Nonce management | **Hardcoded to 0** | Only works for first-time setup |
| Address change handling | **Broken** | Auto-sync overwrites address without invalidating key |
| Rate limit awareness | **Not implemented** | 50 link_signer per 7 days per subaccount |
| Chain switching | Working | `ensureChainAndGetClient()` forces Ink chain |

**Issue: Repeated POST orphans linked signers (P0)**

Each POST to `/api/auth/nado/setup` generates a new random wallet, encrypts it, and stores it — overwriting any previous key. If the user already completed the LinkSigner approval but the PUT failed, the stored key no longer matches the one approved on-chain. The user is stuck with a linked signer that TFC doesn't have the key for.

**Issue: Address change breaks signing (P0)**

`/api/auth/nado/me` auto-syncs `accountAddress` when the user connects a different wallet. But the `encryptedKeyData` (linked signer) was generated for the original wallet's subaccount. Signing will fail because the EIP-712 `sender` field (subaccount) won't match.

**Recommended fix:**
1. On POST: Check if a valid linked signer already exists before generating new one
2. On address change: Invalidate `agentApproved`, `encryptedKeyData`, and prompt re-setup
3. Implement revocation (set signer to zero address) before new key generation

### 3.12 Rate Limiting

| Component | Rate Limiting | Notes |
|-----------|--------------|-------|
| Gateway queries (`nadoQuery`) | **Serial queue, 50ms gap** | Correct but could be 30-40ms |
| Archive requests (`nadoArchive`) | **None** | Can trigger 429 with concurrent calls |
| Trigger requests | **None** | Uses `nadoExecute` which has no queue |
| WS proxy `/api/nado/query` | **None** | Open proxy, no auth or limits |
| WS proxy `/api/nado/archive` | **None** | Same |
| `getNadoMidPrice` (order router) | **Bypasses rate limiter** | Direct `fetch()` to gateway |
| WS adapter `fetchAndEmitOrders` | **No client-side throttle** | Sends N requests per product in parallel |

**Nado's actual rate limits:**
- Gateway: 2400/min per IP for queries, 600/min for orders
- Archive: Weight-based (varies by endpoint)
- WS: 100 connections/IP, 5 authenticated/wallet

**Comparison:**
- Pacifica: Standard HTTP 429 handling + exponential backoff in chart route
- Hyperliquid: Serial queue (100ms gap) for all info requests

**Recommended fix:**
1. Add rate limiter to `nadoArchive` (separate queue, 100ms gap)
2. Route `getNadoMidPrice` through `nadoQuery`
3. Add auth + rate limiting to proxy routes
4. Batch or throttle `fetchAndEmitOrders` (max 5 concurrent)

### 3.13 Error Handling

| Pattern | Pacifica | Hyperliquid | Nado |
|---------|----------|-------------|------|
| HTTP 429 → `RateLimitError` | Yes | Yes | **Yes (gateway only)** |
| Non-OK → `ServiceUnavailableError` | Yes | Yes | Yes |
| Typed error classes | Static imports | Dynamic imports | **Dynamic imports** |
| Order errors → `OrderResult` | N/A (client signs) | `{ success, error }` | `{ success, error }` |
| User-friendly error messages | Yes (stop order direction) | Yes (builder fee reset) | **No** |
| Structured logging | Partially | console.log | **console.log everywhere** |
| Error codes | `ErrorCode` enum | `ErrorCode` enum | **Raw strings** |

**Issues:**
1. Dynamic imports for error classes in hot paths (adapter lines 310-314)
2. 17+ `console.log`/`console.warn`/`console.error` statements in WS adapter alone
3. No user-friendly error messages for common Nado errors (2028 sig mismatch, 2024 no deposits)
4. Order router logs full request/response bodies including signatures

---

## 4. Critical Bugs

### BUG-1: `.replace('-USD', '')` Breaks Nado Symbols (35 occurrences)

**File:** `apps/web/src/app/trade/page.tsx`
**Impact:** Order placement, position matching, TP/SL filtering, UI display — all broken for Nado
**Root cause:** Nado uses `BTC-PERP` format. `.replace('-USD', '')` returns `BTC-PERP` unchanged instead of `BTC`.

Key broken locations:
- **Line 511** (`executeOrder`): Sends wrong symbol to order API
- **Line 801** (`handleClosePosition`): Wrong symbol for close order
- **Line 1031-1077**: TP/SL order matching fails, shows no TP/SL for Nado positions
- **Line 386-462**: Leverage and margin mode lookups fail

**Fix:** Create and use a shared utility:
```typescript
function getBaseToken(symbol: string): string {
  return symbol.replace(/-USD$/, '').replace(/-PERP$/, '');
}
```

### BUG-2: Fight Stake Enforcement Uses Pacifica-Only API

**File:** `apps/web/src/app/api/fights/stake-info/route.ts`, line 107
**Impact:** Fight stake limits not enforced for HL/Nado users — users can exceed stake
**Root cause:** `import { getPositions } from '@/lib/server/pacifica'` hardcodes Pacifica

**Fix:** Use `ExchangeProvider.getAdapter(exchangeType).getPositions()` with exchange type from request.

### BUG-3: Auth Setup Orphans Linked Signers

**File:** `apps/web/src/app/api/auth/nado/setup/route.ts`
**Impact:** Users can get stuck with broken auth if they retry setup
**Root cause:** POST always generates new key without checking/revoking existing one

**Fix:** Check `agentApproved` status before generating new key. If already approved, return existing typed data.

### BUG-4: `cancelStopOrder` Routes to Wrong Service

**File:** `apps/web/src/lib/server/exchanges/nado-order-router.ts`, lines 501-508
**Impact:** Stop order/TP/SL cancellation may silently fail
**Root cause:** Uses `cancelOrder()` which sends to Gateway. Stop orders live on Trigger service.

**Fix:** Send cancel request to `NADO_TRIGGER_URL` for stop/trigger orders.

---

## 5. Code Quality Issues

### 5.1 Duplicated Code

| What | Where | Lines Duplicated |
|------|-------|-----------------|
| `NADO_GATEWAY_URL` constant | `nado-adapter.ts` + `nado-order-router.ts` | 2 |
| `addressToSubaccount` function | `nado-adapter.ts` + `nado-ws-adapter.ts` | ~15 each |
| `granularityMap` object | `nado-ws-adapter.ts` × 3 | ~10 each |
| TP/SL order body construction | `nado-order-router.ts` `setTpSl()` | ~50 lines × 2 |
| Sort functions in trade page | `page.tsx` × 6 locations | ~20 each |
| Mobile vs Desktop layout | `page.tsx` | ~1500 lines duplicated |

### 5.2 Excessive Console Logging

| File | Count | Production Risk |
|------|-------|----------------|
| `nado-ws-adapter.ts` | 17+ console.* | High (runs in browser) |
| `nado-order-router.ts` | 4 console.log per order | High (logs signatures) |
| `nado-adapter.ts` | 5+ console.* | Medium |

### 5.3 Missing Type Safety

- `page.tsx`: `any` type in sort callbacks (lines 1484, 1698, 1718)
- `nado-adapter.ts`: Response types use generic `Record<string, unknown>`
- `nado-ws-adapter.ts`: WS message handlers cast to `any`
- `EditOrderParams` interface missing `side` field

### 5.4 Dead Code

| What | File | Line |
|------|------|------|
| `NADO_CHAIN_ID` unused const | `NadoSetup.tsx` | 11 |
| `{false && ...}` JSX block | `page.tsx` | 1682 |
| `order_update` handler (never receives data) | `nado-ws-adapter.ts` | 951 |
| `usePacificaWsStore` / `usePacificaWebSocket` aliases | `useExchangeWebSocket.ts` | 86, 220 |
| `batchAsync` helper (used once) | `nado-ws-adapter.ts` | 247 |

### 5.5 Hardcoded Values

| What | Value | File | Should Be |
|------|-------|------|-----------|
| `maxOrderSize` | `'1000000'` | `nado-adapter.ts:480` | From product metadata |
| `markPrice` | `'0'` | `nado-adapter.ts:733` | From oracle/mark price |
| `leverage` | `'1'` | `nado-adapter.ts:734` | From position margin data |
| `liquidationPrice` | `'0'` | `nado-adapter.ts:736` | Calculated from health |
| `margin` | `'0'` | `nado-adapter.ts:732` | From subaccount health |
| `nonce` | `0` | `setup/route.ts:103` | Track/increment for re-setup |
| `productId` | `0` | `nado-order-router.ts:758` | USDT0 product ID constant |
| `high24h` / `low24h` fallback | `±2%` | `nado-ws-adapter.ts:1060` | `0` or `undefined` |
| Market order expiration | `60s` | `nado-order-router.ts:284` | `120-300s` safer |

---

## 6. Performance Risks

### PERF-1: `emitPrices()` called on every BBO message (HIGH)

With 20+ products emitting BBO at ~50ms, this creates ~400 invocations/second. Each invocation iterates ALL products.

**Fix:** Debounce to 100ms or batch BBO updates.

### PERF-2: `getOpenOrders` sends N serial requests (HIGH)

50ms × 20 products = 1+ second minimum. Happens on every order refresh.

**Fix:** Check if Nado has `open_orders` query for full subaccount, or cache aggressively.

### PERF-3: `fetchMarketStats` makes N+2 requests every 60s (MEDIUM)

1 `market_snapshots` + 1 `perp_prices` + N `candlesticks` (one per product).

**Fix:** Batch candle requests (already batched in groups of 5 with 200ms delay — acceptable but slow).

### PERF-4: `displayPositions` not memoized (HIGH)

**File:** `page.tsx` line 974 — 160+ lines of computation per position runs on EVERY render.

**Fix:** Wrap in `useMemo` with proper deps.

### PERF-5: Price updates re-render entire trade page (MEDIUM)

`usePrices` creates new `prices` object on every tick, triggering re-render of the entire `TradePageContent`.

**Fix:** Move prices into Zustand store with selector-based access, or use `useRef` + selective updates.

### PERF-6: Product cache uses linear search in hot paths (LOW)

`getProductById` and `getProductBySymbol` do `Array.find()`. Should use `Map<number, Product>` and `Map<string, Product>`.

### PERF-7: Module-level product cache never refreshes (MEDIUM)

`productCacheLoaded = true` is set once. Oracle prices, funding rates, and OI in the cache become stale.

**Fix:** Add TTL-based refresh (e.g., every 5 minutes) or invalidate on interval.

---

## 7. Security Risks

### SEC-1: Open Proxy Routes (MEDIUM)

**Files:** `/api/nado/query/route.ts`, `/api/nado/archive/route.ts`

No authentication, no rate limiting. Anyone can use these proxies to query any Nado data or amplify traffic from TFC's IP.

**Fix:** Require auth token, add per-IP rate limiting.

### SEC-2: Request/Response Body Logging (MEDIUM)

**File:** `nado-order-router.ts` lines 118, 131-134

Logs first 500 chars of request body (includes `signature`) and full response status + body.

**Fix:** Redact signature field from logs. Remove response body logging in production.

### SEC-3: No Input Validation on Order Parameters (LOW)

`order_id`, `amount`, `price`, `symbol` pass through to Nado with minimal validation. While Nado rejects invalid data, crafted inputs could cause unexpected EIP-712 signing behavior.

**Fix:** Validate `order_id` is valid hex, amounts are positive numbers, prices are within reasonable bounds.

### SEC-4: Agent Key in Memory After Decryption (LOW)

After `decryptKey()`, the raw private key exists in JS heap until garbage collected. Every order call decrypts fresh (no caching), which is safer from a window-of-exposure perspective but adds DB + decrypt overhead.

**Trade-off accepted:** Current approach is reasonable. A short-lived LRU cache (30s TTL) would reduce overhead without significant security degradation.

---

## 8. Refactoring Recommendations

### R1: Create Shared Nado Config Module

Centralize all Nado constants, URL configs, and helper functions:

```
apps/web/src/lib/server/exchanges/nado/
  config.ts         - URLs, chain ID, builder config
  types.ts          - Nado API request/response types
  encoding.ts       - toX18, fromX18, encodeAppendix, addressToSubaccount, generateNonce
  rate-limiter.ts   - Request queues for gateway + archive
  adapter.ts        - ExchangeAdapter implementation
  order-router.ts   - ExchangeOrderRouter implementation
```

### R2: Implement WS Authentication

Required for `order_update` stream. Implementation:

```typescript
// Sign StreamAuthentication { sender: bytes32, expiration: uint64 }
const expiration = BigInt(Date.now() + 100_000); // +100 seconds
const domain = getNadoDomain(endpointAddress);
const sig = await wallet.signTypedData(domain, STREAM_AUTH_TYPES, { sender: subaccount, expiration });
ws.send(JSON.stringify({ method: 'authenticate', tx: { sender: subaccount, expiration: String(expiration) }, signature: sig }));
```

### R3: Add Orderbook Resync Timer

```typescript
// Every 30 seconds, re-fetch orderbook snapshot
this.orderbookResyncInterval = setInterval(() => {
  this.orderbookSubs.forEach((_, symbol) => {
    this.fetchOrderbookSnapshot(symbol);
  });
}, 30_000);
```

### R4: Extract `getBaseToken()` Utility

```typescript
// packages/shared/src/symbols.ts
export function getBaseToken(symbol: string): string {
  return symbol.replace(/-USD$/, '').replace(/-PERP$/, '');
}
```

Replace all 35 instances of `.replace('-USD', '')` in `page.tsx`.

### R5: Add Price/Size Rounding to Order Router

```typescript
// Before EIP-712 signing:
const meta = await getNadoProductMeta(symbol);
const roundedPrice = Math.round(price / meta.tickSize) * meta.tickSize;
const roundedAmount = Math.round(amount / meta.lotSize) * meta.lotSize;
```

### R6: Split Trade Page Component

Extract from the 4000+ line `page.tsx`:
- `OrdersTable.tsx` — shared between mobile/desktop
- `PositionsTable.tsx` — same
- `TradeHistoryTable.tsx` — same
- `OrderEntryForm.tsx` — the right-side order panel
- `MarketInfoBar.tsx` — top price bar

### R7: Make Account Panel Exchange-Agnostic

Remove `pacificaConnected` gates from deposit/withdraw buttons and account stats. Use `isExchangeConnected` from `ExchangeContext` instead.

---

## 9. Structured Action Plan

### Phase 1: Critical Bug Fixes (Day 1-2)

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 1.1 | Create `getBaseToken()` utility, replace 35 `.replace('-USD', '')` | `packages/shared`, `page.tsx` | P0 |
| 1.2 | Fix stake-info to use exchange-agnostic adapter | `stake-info/route.ts` | P0 |
| 1.3 | Fix auth setup to not orphan linked signers | `auth/nado/setup/route.ts` | P0 |
| 1.4 | Fix `cancelStopOrder` to route to Trigger service | `nado-order-router.ts` | P0 |
| 1.5 | Fix `editOrder` side defaulting to 'BUY' | `nado-order-router.ts` | P1 |
| 1.6 | Fix trade history timestamps (`executedAt`) | `nado-adapter.ts` | P1 |
| 1.7 | Fix `position_change` to emit full position set | `nado-ws-adapter.ts` | P1 |

### Phase 2: Data Quality (Day 3-4)

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 2.1 | Add price/size rounding to order router | `nado-order-router.ts` | P1 |
| 2.2 | Populate `markPrice`, `leverage`, `margin`, `liquidationPrice` in positions | `nado-adapter.ts` | P1 |
| 2.3 | Add periodic product cache refresh (5 min TTL) | `nado-adapter.ts` | P2 |
| 2.4 | Add orderbook resync timer (30s) | `nado-ws-adapter.ts` | P2 |
| 2.5 | Debounce `emitPrices()` to 100ms | `nado-ws-adapter.ts` | P2 |
| 2.6 | Replace fake `high24h`/`low24h` with 0 or real data | `nado-ws-adapter.ts` | P3 |

### Phase 3: Missing Features (Day 5-7)

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 3.1 | Implement WS `StreamAuthentication` for `order_update` | `nado-ws-adapter.ts` | P1 |
| 3.2 | Show deposit/withdraw UI for all exchanges | `page.tsx` | P1 |
| 3.3 | Show account stats panel for all exchanges | `page.tsx` | P2 |
| 3.4 | Add `max_withdrawable` pre-check | `nado-order-router.ts` | P2 |
| 3.5 | Implement trigger order listing (requires auth) | `nado-adapter.ts` | P2 |
| 3.6 | Add rate limiter to Archive requests | `nado-adapter.ts` | P2 |
| 3.7 | Add auth + rate limiting to proxy routes | `api/nado/` | P2 |

### Phase 4: Code Quality (Day 8-10)

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 4.1 | Centralize Nado config (URLs, chain ID, constants) | New `nado/config.ts` | P2 |
| 4.2 | Remove duplicated `addressToSubaccount`, `granularityMap` | Multiple | P3 |
| 4.3 | Extract `setTpSl` helper to reduce duplication | `nado-order-router.ts` | P3 |
| 4.4 | Replace console.log with conditional debug logger | All Nado files | P3 |
| 4.5 | Add static imports for error classes | `nado-adapter.ts` | P3 |
| 4.6 | Remove dead code (unused constants, `{false && ...}` blocks) | Multiple | P3 |
| 4.7 | Add `useMemo` to `displayPositions` / `displayFightPositions` | `page.tsx` | P2 |

### Phase 5: Frontend Refactoring (Day 11-14)

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 5.1 | Replace exchange-specific `canTrade` ternaries with hook | `page.tsx` | P2 |
| 5.2 | Replace exchange-specific validation in `handlePlaceOrder` | `page.tsx` | P2 |
| 5.3 | Extract shared table components (Orders, Positions, Trades) | New components | P3 |
| 5.4 | Extract OrderEntryForm component | New component | P3 |
| 5.5 | Move price state to Zustand with selectors | `usePrices.ts` | P3 |

### Phase 6: Testing (Ongoing)

| # | Task | Priority |
|---|------|----------|
| 6.1 | Unit tests for `toX18`/`fromX18` edge cases | P2 |
| 6.2 | Unit tests for `encodeAppendix` bit layout | P2 |
| 6.3 | Unit tests for `addressToSubaccount` encoding | P3 |
| 6.4 | Integration test: order placement → fill → position update | P2 |
| 6.5 | Integration test: WS reconnection + subscription recovery | P3 |

---

## Appendix: All Issues by Severity

### P0 — Critical (4)
1. BUG-1: `.replace('-USD', '')` × 35 breaks Nado symbols
2. BUG-2: Fight stake uses Pacifica-only API
3. BUG-3: Auth setup orphans linked signers
4. BUG-4: `cancelStopOrder` routes to wrong service

### P1 — High (8)
5. Edit order defaults side to 'BUY'
6. Trade history timestamps always `Date.now()`
7. `position_change` emits partial position set
8. Price/size rounding missing in order router
9. Position `markPrice`/`leverage`/`margin`/`liqPrice` hardcoded
10. WS auth not implemented (`order_update` stream)
11. Deposit/Withdraw UI hidden for non-Pacifica
12. Orderbook has no desync detection

### P2 — Medium (14)
13. `emitPrices` called too frequently (no debounce)
14. `getOpenOrders` N serial requests (slow)
15. Product cache never refreshes
16. Archive requests have no rate limiting
17. `getNadoMidPrice` bypasses rate limiter
18. Proxy routes have no auth or rate limiting
19. `setTpSl` amount defaults to 0 without validation
20. `fromX18` precision loss for very large values
21. Nonce random uses `Math.random()` not crypto
22. Account stats panel hidden for non-Pacifica
23. Auto-sync address change doesn't invalidate key
24. Connection sync polls every 5s forever
25. `displayPositions` not memoized
26. `displayFightPositions` not memoized

### P3 — Low (12+)
27. Order status is binary (filled/canceled, no partial)
28. Duplicated code (addressToSubaccount, granularityMap, TP/SL body, sort functions)
29. 17+ console.log in WS adapter
30. Request/response body logging includes signatures
31. Dead code (unused constants, unreachable JSX, dead handlers)
32. Hardcoded values (maxOrderSize, market order expiration, USDT0 product ID)
33. Dynamic imports for error classes
34. Missing type safety (`any` types in callbacks)
35. Nonce discard time only 50ms
36. `batchAsync` helper only used once
37. 4000+ line page.tsx component
38. Mobile/desktop layout duplication (~1500 lines)
