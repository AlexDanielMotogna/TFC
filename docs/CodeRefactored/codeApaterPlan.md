# Multi-Exchange Refactoring Plan: Trading Terminal

## Context

The trading terminal (`trade/page.tsx`, 4046 lines) is deeply coupled to Pacifica. We need to prepare the codebase for **Hyperliquid** and **Lighter** integration, making the code hybrid/exchange-agnostic. An adapter pattern already exists (Phase 1-3 complete: interface, PacificaAdapter, CachedAdapter, Provider, 12 READ routes migrated). This plan extends the abstraction to trading operations, signing, WebSocket, TradingView, and the database.

**Key differences between exchanges:**

| Aspect | Pacifica | Hyperliquid | Lighter |
|--------|----------|-------------|---------|
| Chain | Solana | Custom L1 (HyperBFT) | Ethereum L2 (ZK-rollup) |
| Signing | Ed25519 + Base58 | ECDSA (EVM wallet) | ZK-based / API keys |
| Symbols | `"BTC"` | Numeric asset index | Market ID (uint8) |
| Sides | `bid/ask` | `isBuy` boolean | Standard |
| TIF | GTC/IOC/ALO/TOB | GTC/IOC/ALO | GTC/IOC/POST_ONLY |
| Builder code | Yes | Yes (builder param) | Referral system |
| Min order | $11 | $10 | Per-market |
| API style | REST + WS | POST-only + WS | REST + WS |
| Wallet | Solana | Ethereum | Ethereum |

---

## Phase 1: Exchange Config & Context (Foundation)

**Goal:** Establish the concept of "active exchange" — additive only, no behavior changes.

### Create: `packages/shared/src/exchanges.ts`
- `ExchangeType = 'pacifica' | 'hyperliquid' | 'lighter'`
- `ExchangeConfig` interface: type, name, chain, walletType, depositUrl, wsUrl, apiUrl, minOrderValue, signingScheme, supportedOrderTypes, supportedTif, maxBatchSize, hasBuilderCode, hasMarginMode
- `EXCHANGE_CONFIGS` constant with all three exchange configs

### Create: `apps/web/src/contexts/ExchangeContext.tsx`
- React context providing: `exchangeType`, `exchangeConfig`, `isExchangeConnected`, `switchExchange()`
- Reads from auth store

### Modify: `apps/web/src/lib/store.ts`
- Add `exchangeType: ExchangeType` (default: `'pacifica'`)
- Add `exchangeConnected: boolean` (alias for `pacificaConnected` initially)
- Keep backward-compat getters for `pacificaConnected`

**Effort:** 1-2 days | **Risk:** Low

---

## Phase 2: Signing Abstraction Layer

**Goal:** Each exchange signs differently. Abstract signing so hooks don't care which exchange.

### Create: `apps/web/src/lib/signing/types.ts`
```typescript
interface ExchangeSigner {
  readonly exchangeType: ExchangeType;
  getAccountId(): string;
  signMarketOrder(params): Promise<SignedOperation>;
  signLimitOrder(params): Promise<SignedOperation>;
  signCancelOrder(params): Promise<SignedOperation>;
  signStopOrder(params): Promise<SignedOperation>;
  signSetTpSl(params): Promise<SignedOperation>;
  signUpdateLeverage(params): Promise<SignedOperation>;
  signEditOrder(params): Promise<SignedOperation>;
  signWithdraw(params): Promise<SignedOperation>;
  signApproveBuilderCode?(params): Promise<SignedOperation>;
}
```
- Params use normalized types: `side: 'BUY' | 'SELL'`, `symbol: 'BTC-USD'`

### Create: `apps/web/src/lib/signing/pacifica-signer.ts`
- Wraps existing `apps/web/src/lib/pacifica/signing.ts`
- Converts normalized → Pacifica format internally (`BUY` → `bid`, `BTC-USD` → `BTC`)

### Create: `apps/web/src/lib/signing/hyperliquid-signer.ts` (stub)
- ECDSA signing via ethers.js/viem
- Converts `BTC-USD` → asset index

### Create: `apps/web/src/lib/signing/lighter-signer.ts` (stub)
- ZK-based or API key signing
- Converts `BTC-USD` → market ID

### Create: `apps/web/src/lib/signing/signer-factory.ts`
- `createSigner(exchangeType, wallet)` → returns correct signer

### Create: `apps/web/src/hooks/useSigner.ts`
- Hook that returns the correct `ExchangeSigner` based on context

**Effort:** 3-4 days | **Risk:** Medium (must ensure Pacifica signing is byte-identical)

---

## Phase 3: Refactor Frontend Trading Hooks

**Goal:** Make `useOrders.ts` (1161 lines, 12 hooks) exchange-agnostic.

### Modify: `apps/web/src/hooks/useOrders.ts`
All 12 hooks change from:
```typescript
// OLD: imports Pacifica signing directly
const { signature, timestamp } = await createSignedMarketOrder(wallet, {
  symbol: symbol.replace('-USD', ''),
  side: selectedSide === 'LONG' ? 'bid' : 'ask',
  ...
});
```
To:
```typescript
// NEW: uses exchange-agnostic signer
const signer = useSigner();
const { signature, timestamp, metadata } = await signer.signMarketOrder({
  symbol: 'BTC-USD',           // stays normalized
  side: 'BUY',                 // stays normalized
  ...
});
// POST includes: exchange: exchangeType
```

### Modify: `apps/web/src/app/trade/page.tsx`
- Remove `symbol.replace('-USD', '')` everywhere (symbols stay normalized)
- Change `side: 'bid' | 'ask'` → `side: 'BUY' | 'SELL'`
- Replace hardcoded `$11 minimum` with `exchangeConfig.minOrderValue`

### Modify: `apps/web/src/components/Positions.tsx`
- Side mapping in close/TP/SL actions uses normalized format

**Effort:** 4-5 days | **Risk:** High (every trading path affected)
**Mitigation:** Feature flag `USE_NORMALIZED_HOOKS` with old hooks as fallback

---

## Phase 4: Backend Trading Route Refactoring

**Goal:** Backend trading routes become exchange-aware, routing signed requests to the correct exchange.

### Create: `apps/web/src/lib/server/exchange-router.ts`
```typescript
interface ExchangeOrderRouter {
  createMarketOrder(params): Promise<ExchangeOrderResult>;
  createLimitOrder(params): Promise<ExchangeOrderResult>;
  createStopOrder(params): Promise<ExchangeOrderResult>;
  cancelOrder(params): Promise<ExchangeCancelResult>;
  // ... etc
}
```

### Create: `apps/web/src/lib/server/routers/pacifica-router.ts`
- Extract existing proxy logic from `POST /api/orders`
- Converts normalized → Pacifica format, proxies to `api.pacifica.fi`

### Create: `apps/web/src/lib/server/routers/hyperliquid-router.ts` (stub)
### Create: `apps/web/src/lib/server/routers/lighter-router.ts` (stub)

### Modify ALL trading API routes (10 routes):
- `POST /api/orders` — add `exchange` field, route via `getOrderRouter(exchange)`
- `POST /api/orders/stop/create`
- `POST /api/orders/batch`
- `DELETE /api/orders/[orderId]`
- `POST /api/orders/stop/cancel`
- `POST /api/orders/edit`
- `POST /api/positions/tpsl`
- `POST /api/account/leverage`
- `POST /api/account/margin`
- `POST /api/account/withdraw`

Stake validation, trade recording, fight tracking stay exchange-agnostic.

**Effort:** 5-6 days | **Risk:** High
**Mitigation:** `exchange` param defaults to `'pacifica'` so existing clients unchanged

---

## Phase 5: WebSocket Abstraction (parallel with Phase 2-3)

**Goal:** Abstract real-time WebSocket data so each exchange provides its own stream.

### Create: `apps/web/src/lib/ws/types.ts`
```typescript
interface ExchangeWsAdapter {
  connect(accountId?: string): void;
  disconnect(): void;
  isConnected(): boolean;
  subscribePrices(onUpdate: (prices: NormalizedPrice[]) => void): void;
  subscribePositions(accountId, onUpdate): void;
  subscribeOrders(accountId, onUpdate): void;
  subscribeTrades(accountId, onUpdate): void;
  subscribeCandles(symbol, interval, onUpdate): string;
  unsubscribeCandles(subscriptionId): void;
}
```

### Create: `apps/web/src/lib/ws/pacifica-ws-adapter.ts`
- Wraps existing logic from `usePrices.ts` + `usePacificaWebSocket.ts`
- Normalizes compact format (`s`, `d`, `a`, `p`) → standard types

### Create: `apps/web/src/lib/ws/hyperliquid-ws-adapter.ts` (stub)
### Create: `apps/web/src/lib/ws/lighter-ws-adapter.ts` (stub)

### Modify: `apps/web/src/hooks/usePrices.ts`
- Use `ExchangeWsAdapter` instead of raw Pacifica WebSocket

### Rename: `usePacificaWebSocket.ts` → `useExchangeWebSocket.ts`
- Zustand store: `usePacificaWsStore` → `useExchangeWsStore`

**Effort:** 4-5 days | **Risk:** Medium

---

## Phase 6: TradingView & Trade Page Cleanup

**Goal:** Make TradingView and the trade page exchange-aware.

### Create: `apps/web/src/lib/tradingview/ExchangeDatafeed.ts`
- Uses exchange name from config, delegates to WS adapter for candles
- `/api/chart/candles` already supports multi-source fallback

### Create: `apps/web/src/lib/exchanges/liquidation.ts`
- Per-exchange liquidation price formula
- Pacifica formula already known; Hyperliquid/Lighter TBD

### Modify: `apps/web/src/app/trade/page.tsx`
- Replace `pacificaConnected` → `isExchangeConnected`
- Replace `PACIFICA_DEPOSIT_URL` → `exchangeConfig.depositUrl`
- Replace hardcoded `$11` → `exchangeConfig.minOrderValue`
- Conditional builder code flow: `exchangeConfig.hasBuilderCode`
- Replace `usePacificaWsStore` → `useExchangeWsStore`
- Leverage constraints: abstract per-exchange rules

**Effort:** 5-7 days | **Risk:** High (4000+ line file)

---

## Phase 7: Database Schema & Auth

### Modify: `packages/db/prisma/schema.prisma`
```prisma
model ExchangeConnection {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  exchangeType    String   @map("exchange_type") // 'pacifica', 'hyperliquid', 'lighter'
  accountAddress  String   @map("account_address")
  vaultKeyRef     String?  @map("vault_key_reference")
  isPrimary       Boolean  @default(false)
  metadata        Json?    // { builderCodeApproved: true }, etc.
  isActive        Boolean  @default(true)
  connectedAt     DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id])
  @@unique([userId, exchangeType])
  @@map("exchange_connections")
}
```
- Migrate `PacificaConnection` data → `ExchangeConnection`
- Rename `FightTrade.pacificaHistoryId` → `exchangeHistoryId`
- Rename `Trade.pacificaOrderId` → `exchangeOrderId`

### Modify: `apps/web/src/hooks/useAuth.ts`
- Support both Solana (Pacifica) and Ethereum (Hyperliquid/Lighter) wallets
- Add wagmi provider for EVM wallets

**Effort:** 5-7 days | **Risk:** High (production data migration)

---

## Phase 8: Hyperliquid Adapter Implementation

**Goal:** First non-Pacifica exchange end-to-end.

### Create: `apps/web/src/lib/server/exchanges/hyperliquid-adapter.ts`
- Implements all 15 `ExchangeAdapter` interface methods
- POST-only API to `api.hyperliquid.xyz/info` + `/exchange`
- Symbol mapping: `BTC-USD` → asset index 0
- Builder code: `{"b": address, "f": fee_in_tenths_bps}`

### Complete all stubs:
- `hyperliquid-signer.ts` — ECDSA signing
- `hyperliquid-ws-adapter.ts` — WS subscription
- `hyperliquid-router.ts` — order routing

### Modify realtime server:
- `fight-engine.ts` — use exchange-agnostic price fetcher
- `fill-detector.ts` — use exchange-agnostic trade history

**Effort:** 8-10 days | **Risk:** High (new exchange, needs testnet)

---

## Dependency Graph

```
Phase 1 (Config)
    ↓
Phase 2 (Signing) ←→ Phase 5 (WebSocket) [parallel]
    ↓                      ↓
Phase 3 (Hooks) ------→ Phase 6 (Trade Page + TV)
    ↓
Phase 4 (Backend Routes)
    ↓
Phase 7 (Database + Auth)
    ↓
Phase 8 (Hyperliquid Implementation)
```

---

## Feature Flags

| Flag | Default | Phase |
|------|---------|-------|
| `USE_EXCHANGE_ADAPTER` | `true` | Existing (READ routes) |
| `USE_NORMALIZED_HOOKS` | `false` | Phase 3 |
| `USE_EXCHANGE_ROUTER` | `false` | Phase 4 |
| `USE_EXCHANGE_WS` | `false` | Phase 5 |
| `ENABLED_EXCHANGES` | `pacifica` | Phase 1+ |
| `ENABLE_ETHEREUM_WALLET` | `false` | Phase 7 |

---

## File Impact Summary

| Phase | New Files | Modified Files |
|-------|:---------:|:--------------:|
| 1: Config | 3 | 2 |
| 2: Signing | 6 | 0 |
| 3: Hooks | 0 | 3 |
| 4: Backend | 4 | 10 |
| 5: WebSocket | 5 | 3 |
| 6: Trade Page | 2 | 3 |
| 7: Database | 1 | 5 |
| 8: Hyperliquid | 4 | 3 |
| **Total** | **25** | **29** |

---

## Verification

After each phase:
1. **Regression:** All existing Pacifica trading flows must work identically
2. **Feature flag off:** Old behavior unchanged
3. **Feature flag on:** New behavior functionally identical for Pacifica
4. **Unit tests:** Signer implementations produce valid signatures
5. **Integration:** End-to-end order flow: signer → hook → API → router → exchange
6. **Testnet:** Hyperliquid testnet at `api.hyperliquid-testnet.xyz`

## Critical Files Reference

- `apps/web/src/lib/server/exchanges/adapter.ts` — Universal interface (265 lines, complete)
- `apps/web/src/hooks/useOrders.ts` — 12 trading hooks (1161 lines, must refactor)
- `apps/web/src/app/api/orders/route.ts` — Primary trading route (313 lines)
- `apps/web/src/app/trade/page.tsx` — Trading terminal (4046 lines)
- `apps/web/src/hooks/usePacificaWebSocket.ts` — WS store (481 lines)
- `apps/web/src/lib/pacifica/signing.ts` — Current signing (415 lines)
- `packages/db/prisma/schema.prisma` — Database schema
