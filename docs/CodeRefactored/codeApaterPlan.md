# Multi-Exchange Refactoring Plan: Trading Terminal

## Context

The trading terminal (`trade/page.tsx`, 4046 lines) is deeply coupled to Pacifica. We need to prepare the codebase for **Hyperliquid** and **Lighter** integration, making the code hybrid/exchange-agnostic. An adapter pattern already exists (Phase 1-3 complete: interface, PacificaAdapter, CachedAdapter, Provider, 12 READ routes migrated). This plan extends the abstraction to trading operations, signing, WebSocket, TradingView, and the database.

---

## Exchange Comparison Matrix

| Aspect | Pacifica | Hyperliquid | Lighter |
|--------|----------|-------------|---------|
| Chain | Solana | Custom L1 (HyperBFT) | Ethereum L2 (ZK-rollup) |
| Wallet | Solana (Phantom, Solflare) | EVM (MetaMask, Rabby) | EVM (MetaMask, Rabby) |
| Symbols | `"BTC"` | Numeric asset index | Market ID (uint8) |
| Sides | `bid/ask` | `isBuy` boolean | `is_ask` boolean |
| TIF | GTC/IOC/ALO/TOB | GTC/IOC/ALO | GTC/IOC/POST_ONLY |
| Min order | $11 | $10 | Per-market (dynamic) |
| API style | REST + WS | POST-only + WS | REST + WS |
| Builder code | Yes (TradeClub) | Yes (`{b, f}` param) | **No** (zero fees) |
| Revenue model | Builder fee on fills | Builder fee on fills | Referral points only |
| Max batch | 10 orders | 20 orders | 10 orders |
| Margin modes | Cross + Isolated | Cross only | Cross only |

---

## Authentication & Signing Architecture (CRITICAL)

### How Each Exchange Handles Auth & Order Signing

| Aspect | Pacifica | Hyperliquid | Lighter |
|--------|----------|-------------|---------|
| **Signing location** | Client-side (browser) | **Server-side** (backend) | **Server-side** (backend) |
| **Per-trade user interaction?** | YES — user signs every order | **NO** — after one-time setup | **NO** — after one-time setup |
| **Signing scheme** | Ed25519 + Base58 (Solana wallet) | ECDSA / EIP-712 (agent wallet) | Ed25519 (API key via Go binary) |
| **Backend can trade autonomously?** | No | **Yes** (agent wallet) | **Yes** (API private key) |
| **Key storage** | User's wallet (never leaves browser) | Agent wallet private key (backend DB, encrypted) | API private key (backend DB, encrypted) |

### Pacifica Auth Flow (Current — Client-Side Signing)
```
User's Browser                          Our Backend                    Pacifica API
     |                                       |                              |
     |-- 1. Connect Solana wallet ---------->|                              |
     |-- 2. Sign message (prove ownership) ->|-- verify + create JWT ------>|
     |<- 3. JWT token ----------------------|                              |
     |                                       |                              |
     |  [Every order:]                       |                              |
     |-- 4. Sign order with Solana wallet -->|                              |
     |-- 5. POST /api/orders {signature} --->|-- 6. Proxy to Pacifica ----->|
     |                                       |     (forward signature)      |
     |<- 7. Order result -------------------|<- Order result --------------|
```
- **User signs EVERY action** (market order, limit order, cancel, TP/SL, leverage change, withdraw)
- Backend is a pass-through proxy — forwards the client-signed request to Pacifica
- Solana wallet private key never leaves the user's browser

### Hyperliquid Auth Flow (Server-Side via Agent Wallet)
```
User's Browser                          Our Backend                    Hyperliquid API
     |                                       |                              |
     |  [One-time setup:]                    |                              |
     |-- 1. Connect EVM wallet ------------->|                              |
     |-- 2. Sign approveAgent (EIP-712) ---->|-- store agent wallet key --->|
     |-- 3. Sign approveBuilderFee --------->|-- (on-chain, one-time) ----->|
     |                                       |                              |
     |  [Every order — NO user signing:]     |                              |
     |-- 4. POST /api/orders {params} ------>|                              |
     |                                       |-- 5. Sign with agent wallet -|
     |                                       |     (ECDSA, EIP-712)         |
     |                                       |-- 6. POST /exchange -------->|
     |                                       |     {action, nonce, sig,     |
     |                                       |      builder: {b, f}}        |
     |<- 7. Order result -------------------|<- Order result --------------|
```
- **User signs only TWICE** (approveAgent + approveBuilderFee), both one-time
- After setup, backend holds agent wallet private key and signs all trades
- Agent wallet is stateless — holds no funds, cannot withdraw to external addresses
- User can revoke agent at any time from Hyperliquid UI
- Nonces: timestamp in milliseconds, tracked per agent wallet
- Info queries (`/info` endpoint) require no authentication

### Lighter Auth Flow (Server-Side via API Key)
```
User's Browser                          Our Backend                    Lighter API
     |                                       |                              |
     |  [One-time setup:]                    |                              |
     |-- 1. Connect EVM wallet ------------->|                              |
     |-- 2. Generate Ed25519 API key pair -->|                              |
     |      (locally or via lighter.xyz/     |                              |
     |       apikeys)                        |                              |
     |-- 3. Sign ChangePubKey (ETH sig) ---->|-- register key on-chain ---->|
     |-- 4. Provide API private key -------->|-- store encrypted key ------>|
     |                                       |                              |
     |  [Every order — NO user signing:]     |                              |
     |-- 5. POST /api/orders {params} ------>|                              |
     |                                       |-- 6. Sign with API key ------|
     |                                       |     (Ed25519 via Go binary)  |
     |                                       |-- 7. POST /sendTx ---------->|
     |                                       |     {tx_type, tx_hash, sig}  |
     |<- 8. Order result -------------------|<- Order result --------------|
```
- **User signs once** (ChangePubKey) + provides API private key
- After setup, backend holds API private key and signs all trades
- API key indices: 0-1 reserved for lighter.xyz UI, use index 2-254
- Nonces: auto-incrementing per API key, SDK has OptimisticNonceManager
- **No builder code system** — Lighter has zero trading fees
- Revenue: referral points only (25% of referee's points)
- Secure withdrawals always go to original L1 address (API key holder cannot steal funds to different address)
- Auth tokens for read/WS: `{expiry}:{account_index}:{api_key_index}:{random_hex}` (max 8h)
- Read-only tokens: up to 10 years

### Key Security Considerations

| Risk | Pacifica | Hyperliquid | Lighter |
|------|----------|-------------|---------|
| **Private key exposure** | Never (wallet-only) | Agent key in our DB | API key in our DB |
| **Fund theft possible?** | No | No (agent can't withdraw) | Limited (withdraws to original address only) |
| **Revocation** | Disconnect wallet | Revoke agent on HL UI | Delete API key on lighter.xyz |
| **DB encryption** | N/A | AES-256-GCM required | AES-256-GCM required |
| **Key rotation** | N/A | Generate new agent wallet | Generate new API key (index 2-254) |

### What Users Must Do Per Exchange

| Step | Pacifica | Hyperliquid | Lighter |
|------|----------|-------------|---------|
| 1. Connect wallet | Solana wallet | EVM wallet | EVM wallet |
| 2. Deposit funds | On pacifica.fi | On app.hyperliquid.xyz | On app.lighter.xyz |
| 3. Approve agent/key | N/A | Sign `approveAgent` (EIP-712) | Sign `ChangePubKey` (ETH) |
| 4. Approve builder fee | Approve builder code | Sign `approveBuilderFee` (EIP-712) | N/A (no fees) |
| 5. Per-trade action | Sign each order | **Nothing** (backend signs) | **Nothing** (backend signs) |

---

## Phase 1: Exchange Config & Context (Foundation) ✅ COMPLETE

**Goal:** Establish the concept of "active exchange" — additive only, no behavior changes.

### Created: `packages/shared/src/exchanges.ts`
- `ExchangeType = 'pacifica' | 'hyperliquid' | 'lighter'`
- `ExchangeConfig` interface: type, name, chain, walletType, depositUrl, wsUrl, apiUrl, minOrderValue, signingScheme, supportedOrderTypes, supportedTif, maxBatchSize, hasBuilderCode, hasMarginMode
- `EXCHANGE_CONFIGS` constant with all three exchange configs
- `DEFAULT_EXCHANGE = 'pacifica'`

### Created: `apps/web/src/contexts/ExchangeContext.tsx`
- React context providing: `exchangeType`, `exchangeConfig`, `isExchangeConnected`, `switchExchange()`
- Reads from auth store

### Modified: `apps/web/src/lib/store.ts`
- Added `exchangeType: ExchangeType` (default: `'pacifica'`)
- Added `setExchangeType()` action
- Persisted in localStorage, reset on `clearAuth()`

**Status:** Committed as `36b279a`

---

## Phase 2: Signing Abstraction Layer ✅ COMPLETE

**Status:** Committed as `d079385`

**Goal:** Abstract signing so hooks don't care which exchange. Must support TWO signing patterns:
1. **Client-side signing** (Pacifica) — user's wallet signs in the browser
2. **Server-side signing** (Hyperliquid, Lighter) — backend signs with stored delegated keys

### Create: `apps/web/src/lib/signing/types.ts`
```typescript
type SigningLocation = 'client' | 'server';

interface SignedOperation {
  // Client-side signed (Pacifica): includes signature from wallet
  signature?: string;
  timestamp?: number;
  // Server-side signed (HL, Lighter): no signature needed — backend signs
  // Frontend just sends order params, backend handles signing
  exchangeType: ExchangeType;
  params: Record<string, unknown>;
}

interface ExchangeSigner {
  readonly exchangeType: ExchangeType;
  readonly signingLocation: SigningLocation;
  getAccountId(): string;

  // Client-side signers return signed data
  // Server-side signers return params only (backend signs)
  signMarketOrder(params): Promise<SignedOperation>;
  signLimitOrder(params): Promise<SignedOperation>;
  signCancelOrder(params): Promise<SignedOperation>;
  signStopOrder(params): Promise<SignedOperation>;
  signSetTpSl(params): Promise<SignedOperation>;
  signUpdateLeverage(params): Promise<SignedOperation>;
  signEditOrder(params): Promise<SignedOperation>;
  signWithdraw(params): Promise<SignedOperation>;

  // Exchange-specific one-time setup (client-side always)
  approveBuilderCode?(params): Promise<SignedOperation>;  // Pacifica, Hyperliquid
  approveAgent?(params): Promise<SignedOperation>;         // Hyperliquid only
  registerApiKey?(params): Promise<SignedOperation>;       // Lighter only
}
```
- Params use normalized types: `side: 'BUY' | 'SELL'`, `symbol: 'BTC-USD'`

### Create: `apps/web/src/lib/signing/pacifica-signer.ts`
- `signingLocation: 'client'`
- Wraps existing `apps/web/src/lib/pacifica/signing.ts`
- Converts normalized → Pacifica format internally (`BUY` → `bid`, `BTC-USD` → `BTC`)
- Returns actual wallet signature in `SignedOperation`

### Create: `apps/web/src/lib/signing/hyperliquid-signer.ts` (stub)
- `signingLocation: 'server'`
- Does NOT sign on client — just packages params for backend
- Backend will use agent wallet private key for ECDSA / EIP-712 signing
- One-time `approveAgent()` and `approveBuilderFee()` DO sign client-side (EVM wallet)
- Converts `BTC-USD` → asset index

### Create: `apps/web/src/lib/signing/lighter-signer.ts` (stub)
- `signingLocation: 'server'`
- Does NOT sign on client — just packages params for backend
- Backend will use API private key for Ed25519 signing via Go binary
- One-time `registerApiKey()` signs client-side (EVM wallet for ChangePubKey)
- Converts `BTC-USD` → market ID

### Create: `apps/web/src/lib/signing/signer-factory.ts`
- `createSigner(exchangeType, wallet)` → returns correct signer
- For Pacifica: needs Solana wallet adapter
- For Hyperliquid: needs EVM wallet (wagmi/viem)
- For Lighter: needs EVM wallet for setup, then server-side

### Create: `apps/web/src/hooks/useSigner.ts`
- Hook that returns the correct `ExchangeSigner` based on context
- Reads `exchangeType` from `useExchangeContext()`
- Reads wallet from appropriate adapter (Solana or EVM)

**Effort:** 3-4 days | **Risk:** Medium (must ensure Pacifica signing is byte-identical)

---

## Phase 3: Refactor Frontend Trading Hooks ✅ COMPLETE

**Status:** Committed (pending push)

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
const operation = await signer.signMarketOrder({
  symbol: 'BTC-USD',           // stays normalized
  side: 'BUY',                 // stays normalized
  ...
});

// For Pacifica: sends signature (client-signed)
// For HL/Lighter: sends params only (backend will sign)
await fetch('/api/orders', {
  body: JSON.stringify({
    exchange: signer.exchangeType,
    ...operation,
  })
});
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

**Goal:** Backend trading routes become exchange-aware, routing requests to the correct exchange. For Pacifica, backend proxies the client-signed request. For Hyperliquid/Lighter, **backend signs the order itself** using stored delegated keys.

### Create: `apps/web/src/lib/server/exchange-router.ts`
```typescript
interface ExchangeOrderRouter {
  readonly exchangeType: ExchangeType;
  readonly signsServerSide: boolean; // true for HL, Lighter

  // For Pacifica: forwards client signature to exchange
  // For HL: signs with agent wallet, includes builder code
  // For Lighter: signs with API key via Go binary
  createMarketOrder(params): Promise<ExchangeOrderResult>;
  createLimitOrder(params): Promise<ExchangeOrderResult>;
  createStopOrder(params): Promise<ExchangeOrderResult>;
  cancelOrder(params): Promise<ExchangeCancelResult>;
  setTpSl(params): Promise<ExchangeOrderResult>;
  setLeverage(params): Promise<void>;
  withdraw(params): Promise<void>;
}
```

### Create: `apps/web/src/lib/server/routers/pacifica-router.ts`
- `signsServerSide: false`
- Extract existing proxy logic from `POST /api/orders`
- Forwards client-signed request to `api.pacifica.fi`

### Create: `apps/web/src/lib/server/routers/hyperliquid-router.ts` (stub)
- `signsServerSide: true`
- Loads agent wallet private key from DB (encrypted)
- Signs with ECDSA / EIP-712 (phantom agent construction)
- Includes builder code: `{"b": "0xOurAddress", "f": 50}` (0.05%)
- Posts to `api.hyperliquid.xyz/exchange`
- Nonce: current timestamp in milliseconds

### Create: `apps/web/src/lib/server/routers/lighter-router.ts` (stub)
- `signsServerSide: true`
- Loads API private key from DB (encrypted)
- Signs with Ed25519 via Go binary signer (or TypeScript SDK)
- Posts to `mainnet.zklighter.elliot.ai/api/v1/sendTx`
- Nonce: auto-incrementing per API key (OptimisticNonceManager)

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

### WebSocket Authentication Per Exchange

| Exchange | WS Auth | URL |
|----------|---------|-----|
| Pacifica | Wallet address in subscribe message | `wss://ws.pacifica.fi/ws` |
| Hyperliquid | No auth needed for public data; user address for private | `wss://api.hyperliquid.xyz/ws` |
| Lighter | Auth token: `{expiry}:{account}:{key_index}:{hex}` (max 8h) | `wss://mainnet.zklighter.elliot.ai/ws` |

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
- Subscribe: `{"method": "subscribe", "subscription": {"type": "allMids"}}` for prices
- Private data: `{"type": "userEvents", "user": "0x..."}` for positions/orders
- No auth token needed — just user address

### Create: `apps/web/src/lib/ws/lighter-ws-adapter.ts` (stub)
- Auth token required for private channels
- Token generated server-side from API key: `create_auth_token_with_expiry()`
- Public channels (prices, orderbook) need no auth
- Private channels (positions, orders, fills) need auth token in `?auth=` param

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
- Pacifica: `liq = [price - (side * margin) / size] / (1 - side / max_leverage / 2)`
- Hyperliquid: `liq = entryPx * (1 - side * (leverage - 1) / leverage)` (approximate)
- Lighter: TBD (fetch from API or calculate)

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

**Goal:** Support multi-wallet auth and securely store delegated signing keys.

### Modify: `packages/db/prisma/schema.prisma`
```prisma
model ExchangeConnection {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  exchangeType    String   @map("exchange_type") // 'pacifica', 'hyperliquid', 'lighter'
  accountAddress  String   @map("account_address")

  // Delegated signing keys (encrypted with AES-256-GCM)
  // Pacifica: null (client-side signing, no key stored)
  // Hyperliquid: agent wallet private key (ECDSA)
  // Lighter: API private key (Ed25519) + API key index
  encryptedKeyData  String?  @map("encrypted_key_data")
  keyIndex          Int?     @map("key_index") // Lighter API key index (2-254)

  // Setup status
  agentApproved     Boolean  @default(false) // HL: approveAgent completed
  builderApproved   Boolean  @default(false) // HL: approveBuilderFee completed
  apiKeyRegistered  Boolean  @default(false) // Lighter: ChangePubKey completed

  isPrimary       Boolean  @default(false)
  metadata        Json?    // Extra exchange-specific data
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

### Create: `apps/web/src/lib/server/key-vault.ts`
- Encrypt/decrypt delegated keys using AES-256-GCM
- Environment variable: `EXCHANGE_KEY_ENCRYPTION_SECRET`
- Functions: `encryptKey(plaintext)`, `decryptKey(ciphertext)`
- Never log or expose plaintext keys

### Modify: `apps/web/src/hooks/useAuth.ts`
- Support both Solana (Pacifica) and Ethereum (Hyperliquid/Lighter) wallets
- Add wagmi/viem provider for EVM wallets
- Detect wallet type from `exchangeConfig.walletType`

### Create: Exchange Connection Setup Flows
```
Pacifica Setup:
  1. Connect Solana wallet → verify ownership → create JWT
  2. Check Pacifica account exists (REST)
  3. Approve builder code (client-side sign)
  4. Done — every trade signed client-side

Hyperliquid Setup:
  1. Connect EVM wallet → verify ownership → create JWT
  2. Generate agent wallet keypair (backend)
  3. User signs approveAgent (EIP-712, client-side, one-time)
  4. User signs approveBuilderFee (EIP-712, client-side, one-time)
  5. Store encrypted agent private key in ExchangeConnection
  6. Done — backend signs all trades with agent wallet

Lighter Setup:
  1. Connect EVM wallet → verify ownership → create JWT
  2. Generate Ed25519 API keypair (backend, index 2-254)
  3. User signs ChangePubKey (ETH signature, client-side, one-time)
  4. Store encrypted API private key in ExchangeConnection
  5. Done — backend signs all trades with API key
```

**Effort:** 5-7 days | **Risk:** High (production data migration, key security)

---

## Phase 8: Hyperliquid Adapter Implementation

**Goal:** First non-Pacifica exchange end-to-end.

### Create: `apps/web/src/lib/server/exchanges/hyperliquid-adapter.ts`
- Implements all 15 `ExchangeAdapter` interface methods
- POST-only API to `api.hyperliquid.xyz/info` + `/exchange`
- Symbol mapping: `BTC-USD` → asset index 0
- Builder code: `{"b": "0xOurAddress", "f": 50}` (0.05% = 5 bps)

### Implement server-side signing:
- `hyperliquid-server-signer.ts` — ECDSA / EIP-712 phantom agent signing
  - Serialize action via msgpack
  - Append nonce + vault address
  - Hash with keccak256
  - Create phantom agent with connectionId = hash
  - Sign phantom agent with EIP-712 (chain ID 1337)
- Nonce strategy: current timestamp in milliseconds

### Complete all stubs:
- `hyperliquid-signer.ts` — Client-side: only `approveAgent()` + `approveBuilderFee()`
- `hyperliquid-ws-adapter.ts` — WS subscription
- `hyperliquid-router.ts` — Order routing with server-side signing

### Modify realtime server:
- `fight-engine.ts` — use exchange-agnostic price fetcher
- `fill-detector.ts` — use exchange-agnostic trade history

**Effort:** 8-10 days | **Risk:** High (new exchange, needs testnet at `api.hyperliquid-testnet.xyz`)

---

## Phase 9: Lighter Adapter Implementation

**Goal:** Second non-Pacifica exchange end-to-end.

### Create: `apps/web/src/lib/server/exchanges/lighter-adapter.ts`
- Implements all 15 `ExchangeAdapter` interface methods
- REST API to `mainnet.zklighter.elliot.ai`
- Symbol mapping: `BTC-USD` → market index (uint8)

### Implement server-side signing:
- `lighter-server-signer.ts` — Ed25519 signing via Go binary or TypeScript SDK
  - Use `zklighter-sdk` npm package or compiled Go signer via FFI
  - OptimisticNonceManager for low-latency nonce tracking
  - Auth token generation: `create_auth_token_with_expiry()`

### Complete all stubs:
- `lighter-signer.ts` — Client-side: only `registerApiKey()` (ChangePubKey)
- `lighter-ws-adapter.ts` — WS with auth token in `?auth=` param
- `lighter-router.ts` — Order routing with server-side signing

### No builder code needed — zero fees on Lighter

**Effort:** 6-8 days | **Risk:** Medium (simpler API than Hyperliquid)

---

## Dependency Graph

```
Phase 1 (Config) ✅
    ↓
Phase 2 (Signing) ←→ Phase 5 (WebSocket) [parallel]
    ↓                      ↓
Phase 3 (Hooks) ------→ Phase 6 (Trade Page + TV)
    ↓
Phase 4 (Backend Routes)
    ↓
Phase 7 (Database + Auth + Key Vault)
    ↓
Phase 8 (Hyperliquid) ←→ Phase 9 (Lighter) [parallel]
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

## Environment Variables (New)

| Variable | Description | Phase |
|----------|-------------|-------|
| `EXCHANGE_KEY_ENCRYPTION_SECRET` | AES-256-GCM key for encrypting delegated signing keys | Phase 7 |
| `HYPERLIQUID_AGENT_ADDRESS` | Our agent wallet address for Hyperliquid | Phase 8 |
| `HYPERLIQUID_BUILDER_ADDRESS` | Our builder code address for fee collection | Phase 8 |
| `HYPERLIQUID_BUILDER_FEE` | Builder fee in tenths of bps (default: 50 = 0.05%) | Phase 8 |
| `LIGHTER_DEFAULT_KEY_INDEX` | Default API key index for new connections (default: 2) | Phase 9 |

---

## File Impact Summary

| Phase | New Files | Modified Files |
|-------|:---------:|:--------------:|
| 1: Config ✅ | 3 | 2 |
| 2: Signing | 6 | 0 |
| 3: Hooks | 0 | 3 |
| 4: Backend | 4 | 10 |
| 5: WebSocket | 5 | 3 |
| 6: Trade Page | 2 | 3 |
| 7: Database + Auth | 3 | 5 |
| 8: Hyperliquid | 5 | 3 |
| 9: Lighter | 4 | 2 |
| **Total** | **32** | **31** |

---

## Verification

After each phase:
1. **Regression:** All existing Pacifica trading flows must work identically
2. **Feature flag off:** Old behavior unchanged
3. **Feature flag on:** New behavior functionally identical for Pacifica
4. **Unit tests:** Signer implementations produce valid signatures
5. **Integration:** End-to-end order flow: signer → hook → API → router → exchange
6. **Testnet:** Hyperliquid testnet at `api.hyperliquid-testnet.xyz`
7. **Security audit:** Encrypted key storage, no plaintext key logging

## Critical Files Reference

- `apps/web/src/lib/server/exchanges/adapter.ts` — Universal interface (265 lines, complete)
- `apps/web/src/hooks/useOrders.ts` — 12 trading hooks (1161 lines, must refactor)
- `apps/web/src/app/api/orders/route.ts` — Primary trading route (313 lines)
- `apps/web/src/app/trade/page.tsx` — Trading terminal (4046 lines)
- `apps/web/src/hooks/usePacificaWebSocket.ts` — WS store (481 lines)
- `apps/web/src/lib/pacifica/signing.ts` — Current signing (415 lines)
- `packages/db/prisma/schema.prisma` — Database schema
- `packages/shared/src/exchanges.ts` — Exchange configs (Phase 1, complete)
- `apps/web/src/contexts/ExchangeContext.tsx` — Exchange context (Phase 1, complete)

## SDK & API References

- **Hyperliquid Docs:** https://hyperliquid.gitbook.io/hyperliquid-docs
- **Hyperliquid Builder Codes:** https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes
- **Hyperliquid Exchange API:** https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
- **Hyperliquid Python SDK:** https://github.com/hyperliquid-dex/hyperliquid-python-sdk
- **Hyperliquid Testnet:** https://api.hyperliquid-testnet.xyz
- **Lighter API Docs:** https://apidocs.lighter.xyz
- **Lighter General Docs:** https://docs.lighter.xyz
- **Lighter Python SDK:** https://github.com/elliottech/lighter-python
- **Lighter TypeScript SDK:** `zklighter-sdk` on npm
- **Lighter API Keys UI:** https://app.lighter.xyz/apikeys
