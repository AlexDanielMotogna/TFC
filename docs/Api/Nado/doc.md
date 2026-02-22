# Nado Protocol — TFC Integration Reference

> **Source**: https://docs.nado.xyz/developer-resources
> **Last updated**: 2026-02-22

---

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Network Configuration](#network-configuration)
3. [Authentication & Signing (EIP-712)](#authentication--signing-eip-712)
4. [Subaccounts](#subaccounts)
5. [Linked Signers (Delegated Trading)](#linked-signers-delegated-trading)
6. [Gateway API — Executes](#gateway-api--executes)
7. [Gateway API — Queries](#gateway-api--queries)
8. [Trigger Service (TP/SL, Stop Orders, TWAP)](#trigger-service-tpsl-stop-orders-twap)
9. [WebSocket Subscriptions](#websocket-subscriptions)
10. [Archive/Indexer API (Historical Data)](#archiveindexer-api-historical-data)
11. [Products & Markets](#products--markets)
12. [Number Encoding (x18 / x6)](#number-encoding-x18--x6)
13. [Rate Limits](#rate-limits)
14. [Error Codes](#error-codes)
15. [SDK & Libraries](#sdk--libraries)
16. [TFC Integration Mapping](#tfc-integration-mapping)

---

## Overview & Architecture

Nado is an on-chain DEX on **Ink** (L2) supporting spot and perpetual trading. It uses an on-chain order book with off-chain matching (sequencer model).

**Four API services:**

| Service | Purpose | Base URL (Testnet) |
|---------|---------|-------------------|
| **Gateway** | Order execution + real-time queries | `https://gateway.test.nado.xyz/v1` |
| **Subscriptions** | Live WebSocket data feeds | `wss://gateway.test.nado.xyz/v1/subscribe` |
| **Archive/Indexer** | Historical data queries | `https://archive.test.nado.xyz/v1` |
| **Trigger** | Conditional orders (TP/SL, TWAP) | `https://trigger.test.nado.xyz/v1` |

**Mainnet URLs:** Replace `test` with `prod` (e.g., `gateway.prod.nado.xyz`).

---

## Network Configuration

| Environment | Chain | Chain ID | Gateway | Archive | Trigger |
|-------------|-------|----------|---------|---------|---------|
| **Testnet** | Ink Sepolia | `763373` | `gateway.test.nado.xyz/v1` | `archive.test.nado.xyz/v1` | `trigger.test.nado.xyz/v1` |
| **Mainnet** | Ink | `57073` | `gateway.prod.nado.xyz/v1` | `archive.prod.nado.xyz/v1` | `trigger.prod.nado.xyz/v1` |

- **Testnet faucet**: https://testnet.nado.xyz/portfolio/faucet
- **Gas faucet** (Ink Sepolia): https://docs.inkonchain.com/tools/faucets
- **Collateral token**: USDT0 (6 decimals on-chain, but API normalizes to x18)

---

## Authentication & Signing (EIP-712)

All **write operations** require EIP-712 signatures. Read operations (queries) require **no auth**.

### EIP-712 Domain

```json
{
  "name": "Nado",
  "version": "0.0.1",
  "chainId": 763373,
  "verifyingContract": "<depends on operation>"
}
```

### Verifying Contract Selection

| Operation | Verifying Contract |
|-----------|--------------------|
| **Place Order** | Product ID as 20-byte address: `address(productId)` |
| **All other executes** | Endpoint contract (query via `contracts` endpoint) |

**Product ID to contract address:**
```ts
// Product 2 → 0x0000000000000000000000000000000000000002
function genOrderVerifyingContract(productId: number): string {
  return '0x' + productId.toString(16).padStart(40, '0');
}
```

**Endpoint contract** (from `contracts` query):
```
Testnet: 0xf8963f7860af7de9b94893edb9a3b5c155e1fc0c
```

### Valid Signers

Executions can be signed by either:
1. **Main wallet** private key (the wallet that owns the subaccount)
2. **Linked signer** private key (delegated trading key)

### EIP-712 Type Definitions

| Operation | Primary Type | Fields |
|-----------|-------------|--------|
| Place Order | `Order` | `sender(bytes32)`, `priceX18(int128)`, `amount(int128)`, `expiration(uint64)`, `nonce(uint64)`, `appendix(uint128)` |
| Cancel Orders | `Cancellation` | `sender(bytes32)`, `productIds(uint32[])`, `digests(bytes32[])`, `nonce(uint64)` |
| Cancel Product Orders | `CancellationProducts` | `sender(bytes32)`, `productIds(uint32[])`, `nonce(uint64)` |
| Withdraw Collateral | `WithdrawCollateral` | `sender(bytes32)`, `productId(uint32)`, `amount(uint128)`, `nonce(uint64)` |
| Link Signer | `LinkSigner` | `sender(bytes32)`, `signer(bytes32)`, `nonce(uint64)` |
| Liquidate Subaccount | `LiquidateSubaccount` | `sender(bytes32)`, `liquidatee(bytes32)`, `productId(uint32)`, `isEncodedSpread(bool)`, `amount(int128)`, `nonce(uint64)` |
| Stream Auth | `StreamAuthentication` | `sender(bytes32)`, `expiration(uint64)` |
| List Trigger Orders | `ListTriggerOrders` | `sender(bytes32)`, `recvTime(uint64)` |

### Nonce Structure

The nonce is a `uint64` encoded as:
- **Upper 44 bits**: discard time in milliseconds
- **Lower 20 bits**: random integer for collision avoidance

```ts
const nonce = ((Date.now() + 50) << 20) + Math.floor(Math.random() * 1000000);
```

---

## Subaccounts

Subaccounts are the core account model. A single wallet can have multiple subaccounts, each with independent balances, positions, and risk.

### Subaccount Identifier (bytes32)

A 32-byte value = **20 bytes wallet address** + **12 bytes name** (right-padded with zeros).

```
Wallet:     0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Name:       "default" → hex: 64656661756c74
Subaccount: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb64656661756c740000000000
```

```ts
function addressToSubaccount(address: string, name: string = 'default'): string {
  const addr = address.toLowerCase().replace('0x', '');
  const nameHex = Buffer.from(name).toString('hex').padEnd(24, '0');
  return '0x' + addr + nameHex;
}
```

### Key Rules

- Subaccounts don't exist until first deposit of **>= $5 USDT0**
- UI limit: 4 subaccounts; API: unlimited
- Each has independent balances, positions, health metrics
- The "default" subaccount is standard entry point

---

## Linked Signers (Delegated Trading)

Enables server-side signing without exposing the main wallet key. **This is what TFC needs for agent-wallet pattern.**

### How It Works

1. User's main wallet calls `link_signer` to authorize a server-generated key
2. Server stores the linked signer private key (encrypted)
3. All subsequent executes are signed by the linked signer
4. Main wallet retains full control and can revoke at any time

### Link Signer Request

```json
{
  "link_signer": {
    "tx": {
      "sender": "0x<subaccount_bytes32>",
      "signer": "0x<signer_address_padded_to_bytes32>",
      "nonce": "1"
    },
    "signature": "0x<eip712_signature>"
  }
}
```

- `signer`: 20-byte address + 12 bytes padding (can be anything)
- To **revoke**: set signer to zero address
- **Rate limit**: 50 link operations per 7 days per subaccount
- **Minimum balance**: $5 USDT0 in subaccount

### Constraints

- **One linked signer per subaccount**
- Linked signer can execute trades but NOT link a new signer (only main wallet can)
- Auth persists until explicitly revoked

---

## Gateway API — Executes

**Endpoint:** `POST [GATEWAY_URL]/execute`
**WebSocket:** `wss://gateway.test.nado.xyz/v1/ws`

All executes require EIP-712 signature. HTTP requests MUST include `Accept-Encoding: gzip, br, or deflate`.

### Place Order

```json
{
  "place_order": {
    "product_id": 2,
    "order": {
      "sender": "0x<subaccount_bytes32>",
      "priceX18": "30000000000000000000000",
      "amount": "1000000000000000000",
      "expiration": 1700000000,
      "nonce": "1234567890",
      "appendix": "4096"
    },
    "signature": "0x...",
    "id": 100,
    "spot_leverage": true
  }
}
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| `product_id` | number | Product to trade |
| `priceX18` | string | Price * 10^18 |
| `amount` | string | Quantity * 10^18. **Positive = BUY, Negative = SELL** |
| `expiration` | number | Unix timestamp (seconds) for auto-cancel |
| `nonce` | string | Unique per order (see nonce structure above) |
| `appendix` | string | 128-bit encoded order properties |
| `spot_leverage` | bool | `true` allows borrowing; `false` fails if insufficient |

**Response (success):**
```json
{
  "status": "success",
  "data": { "digest": "0x<order_digest_32_bytes>" },
  "request_type": "execute_place_order"
}
```

The `digest` is the unique order ID used for cancellation and tracking.

### Order Appendix Encoding (128-bit)

| Bits | Field | Values |
|------|-------|--------|
| 0-7 | Version | `1` |
| 8 | Isolated | `0` = cross, `1` = isolated |
| 9-10 | Order Type | `0` = DEFAULT (limit), `1` = IOC (market), `2` = FOK, `3` = POST_ONLY |
| 11 | Reduce Only | `0` = normal, `1` = reduce only |
| 12-13 | Trigger Type | `0` = NONE, `1` = PRICE, `2` = TWAP, `3` = TWAP_CUSTOM |
| 38-47 | Builder Fee | Rate in 0.1 bps units |
| 48-63 | Builder ID | Routing identifier |
| 64-127 | Value | TWAP params or isolated margin config |

**Common appendix values:**
```ts
// Standard limit order:       version=1, order_type=DEFAULT → 0x01 → "1"
// IOC (market order):         version=1, order_type=IOC     → (1 << 9) | 1 = "513"
// Reduce-only limit:          version=1, reduce_only=1      → (1 << 11) | 1 = "2049"
// Reduce-only IOC:            version=1, IOC + reduce_only  → (1 << 11) | (1 << 9) | 1 = "2561"
// Post-only:                  version=1, order_type=POST_ONLY → (3 << 9) | 1 = "1537"
// Price trigger (TP/SL):      version=1, trigger=PRICE      → (1 << 12) | 1 = "4097"
// Price trigger IOC:          version=1, IOC + trigger       → (1 << 12) | (1 << 9) | 1 = "4609"
```

### Cancel Orders

```json
{
  "cancel_orders": {
    "tx": {
      "sender": "0x<subaccount_bytes32>",
      "productIds": [2],
      "digests": ["0x<order_digest>"],
      "nonce": "1"
    },
    "signature": "0x..."
  }
}
```

- `productIds` and `digests` arrays must correspond 1:1
- **Response**: Returns cancelled order details

### Cancel Product Orders (cancel all for a product)

```json
{
  "cancel_product_orders": {
    "tx": {
      "sender": "0x<subaccount_bytes32>",
      "productIds": [2],
      "nonce": "1"
    },
    "signature": "0x..."
  }
}
```

### Withdraw Collateral

```json
{
  "withdraw_collateral": {
    "tx": {
      "sender": "0x<subaccount_bytes32>",
      "productId": 0,
      "amount": "1000000",
      "nonce": "1"
    },
    "signature": "0x...",
    "spot_leverage": true
  }
}
```

- **Amount uses RAW token decimals** (not x18). USDT0 = 6 decimals.
- Pre-check with `max_withdrawable` query before submitting.

---

## Gateway API — Queries

**REST:** `GET/POST [GATEWAY_URL]/query`
**WebSocket:** Same WS connection as executes

No authentication required.

### Subaccount Info (positions, balances, health)

```json
{ "type": "subaccount_info", "subaccount": "0x<bytes32>" }
```

**Response includes:**
- `exists`: bool — whether subaccount has been created
- `healths`: `{ initial, maintenance, unweighted }` — each with `assets`, `liabilities`, `health`
- `spot_balances`: array of `{ product_id, amount }` (positive = deposit, negative = borrow)
- `perp_balances`: array of `{ product_id, amount, v_quote_balance, cumulative_funding }`
- `spot_products` / `perp_products`: full product config and state
- Optional `txns` param for trade simulation ("what-if")

### Market Price (Best Bid/Ask)

```json
{ "type": "market_price", "product_id": 2 }
```

**Response:**
```json
{
  "data": {
    "product_id": 2,
    "bid_x18": "24224000000000000000000",
    "ask_x18": "24243000000000000000000"
  }
}
```

### Market Prices (Multiple)

```json
{ "type": "market_prices", "product_ids": [1, 2, 4] }
```

### All Products

```json
{ "type": "all_products" }
```

Returns all spot and perp products with:
- `product_id`, `oracle_price_x18`
- Risk parameters (margin weights)
- Book info: `size_increment`, `price_increment_x18`, `min_size`
- Spot: token address, interest rates, fees, deposits/borrows
- Perp: funding rates, open interest, settlement

### Contracts

```json
{ "type": "contracts" }
```

Returns `chain_id` and `endpoint_addr` (needed for EIP-712 domain).

### Other Gateway Queries

- `max_withdrawable` — max amount that can be withdrawn
- `open_orders` — current open orders for a subaccount
- `nonces` — current nonce values
- `linked_signer` — current linked signer for subaccount
- `linked_signer_rate_limit` — rate limit usage

---

## Trigger Service (TP/SL, Stop Orders, TWAP)

**Endpoint:** `POST [TRIGGER_URL]/execute` and `POST [TRIGGER_URL]/query`

Trigger orders are regular orders held by the trigger service until conditions are met, then forwarded to the gateway.

**Max 25 pending trigger orders per product per subaccount.**

### Place Trigger Order

```json
{
  "place_order": {
    "product_id": 2,
    "order": {
      "sender": "0x<subaccount_bytes32>",
      "priceX18": "0",
      "amount": "-1000000000000000000",
      "expiration": 1700000000,
      "nonce": "...",
      "appendix": "4609"
    },
    "trigger": {
      "price_trigger": {
        "price_requirement": {
          "oracle_price_below": "29000000000000000000000"
        }
      }
    },
    "signature": "0x..."
  }
}
```

### Price Trigger Types

| Type | Use Case |
|------|----------|
| `oracle_price_above` | Take Profit (long) / Stop Loss (short) |
| `oracle_price_below` | Stop Loss (long) / Take Profit (short) |
| `last_price_above` | Based on last trade price |
| `last_price_below` | Based on last trade price |
| `mid_price_above` | Based on mid-book price |
| `mid_price_below` | Based on mid-book price |

### Trigger Dependencies (OCO-like)

Link a trigger to another order so it activates only after the parent fills:

```json
"trigger": {
  "price_trigger": {
    "price_requirement": { "oracle_price_above": "50000000000000000000000" },
    "dependency": {
      "digest": "0x<parent_order_digest>",
      "on_partial_fill": false
    }
  }
}
```

### TWAP Orders

Split large orders across time intervals:

```json
"trigger": {
  "time_trigger": {
    "interval": 30,
    "amounts": ["1000000000000000000", "1000000000000000000"]
  }
}
```

- MUST use IOC order type
- Cannot use isolated margin
- `amounts` optional — splits evenly if omitted

### Query Trigger Orders

```json
{ "list_trigger_orders": { "tx": { "sender": "0x...", "recvTime": "..." }, "signature": "0x..." } }
```

Requires signature (private data).

---

## WebSocket Subscriptions

**Endpoint:** `wss://gateway.test.nado.xyz/v1/subscribe`

**Requirements:**
- `Sec-WebSocket-Extensions: permessage-deflate`
- Send ping frames every 30 seconds

### Subscribe Message

```json
{
  "method": "subscribe",
  "stream": {
    "type": "trade",
    "product_id": 2
  },
  "id": 1
}
```

### Unsubscribe

```json
{
  "method": "unsubscribe",
  "stream": { "type": "trade", "product_id": 2 },
  "id": 2
}
```

### Available Streams

| Stream | Auth | Scope | Description |
|--------|------|-------|-------------|
| `trade` | No | per-product | Executed trades (price, qty, direction) |
| `best_bid_offer` | No | per-product | Top-of-book bid/ask |
| `book_depth` | No | per-product | Incremental depth diffs (~50ms batches) |
| `fill` | No | per-subaccount | Fill details (price, fees, remaining qty) |
| `position_change` | No | per-subaccount | Absolute position state after changes |
| `order_update` | **Yes** | per-subaccount | Order lifecycle (placed, filled, cancelled) |
| `latest_candlestick` | No | per-product + granularity | Live OHLCV updates |
| `liquidation` | No | optional per-product | Liquidation events |
| `funding_payment` | No | per-product | Hourly funding payments |
| `funding_rate` | No | optional per-product | Funding rate updates (~20s) |

### Authentication (for private streams)

```json
{
  "method": "authenticate",
  "id": 10,
  "tx": {
    "sender": "0x<subaccount_bytes32>",
    "expiration": "1700000000000"
  },
  "signature": "0x<eip712_signature>"
}
```

- `expiration`: milliseconds since epoch, must be within 100 seconds of current time
- Sign `StreamAuthentication { sender(bytes32), expiration(uint64) }` with endpoint as verifying contract
- Once authenticated, stays for lifetime of connection
- Grants access to ALL subaccounts under the wallet
- **Max 5 authenticated connections per wallet**

### Event Payloads

#### Trade
```json
{
  "type": "trade",
  "timestamp": "1676151190656903000",
  "product_id": 2,
  "price": "25000000000000000000000",
  "taker_qty": "1000000000000000000",
  "maker_qty": "1000000000000000000",
  "is_taker_buyer": true
}
```

#### Best Bid Offer
```json
{
  "type": "best_bid_offer",
  "product_id": 2,
  "bid_price": "24990000000000000000000",
  "bid_qty": "5000000000000000000",
  "ask_price": "25010000000000000000000",
  "ask_qty": "3000000000000000000"
}
```

#### Book Depth (incremental)
```json
{
  "type": "book_depth",
  "product_id": 2,
  "bids": [["21594490000000000000000", "51007390115411548"]],
  "asks": [["21694490000000000000000", "0"]]
}
```
- `[price_x18, new_quantity_x18]` — quantity `"0"` means level removed

#### Fill
```json
{
  "type": "fill",
  "product_id": 2,
  "subaccount": "0x...",
  "order_digest": "0x...",
  "filled_qty": "1000000000000000000",
  "remaining_qty": "2000000000000000000",
  "original_qty": "3000000000000000000",
  "price": "24991000000000000000000",
  "is_taker": true,
  "is_bid": true,
  "fee": "100000000000000000"
}
```
- `fee`: positive = cost paid, negative = rebate

#### Position Change
```json
{
  "type": "position_change",
  "product_id": 2,
  "subaccount": "0x...",
  "amount": "51007390115411548",
  "v_quote_amount": "-1275000000000000000000",
  "reason": "match_orders"
}
```
- `amount`: **absolute** new position (not delta). Positive = long, negative = short.
- `reason`: `match_orders`, `deposit_collateral`, `withdraw_collateral`, `liquidate_subaccount`, etc.

#### Order Update (requires auth)
```json
{
  "type": "order_update",
  "product_id": 2,
  "digest": "0x...",
  "amount": "82000000000000000",
  "reason": "filled"
}
```
- `reason`: `"placed"`, `"filled"`, `"cancelled"`
- `amount`: remaining unfilled quantity

#### Latest Candlestick
```json
{
  "type": "latest_candlestick",
  "product_id": 2,
  "granularity": 60,
  "open_x18": "25000000000000000000000",
  "high_x18": "25100000000000000000000",
  "low_x18": "24900000000000000000000",
  "close_x18": "25050000000000000000000",
  "volume": "10000000000000000000"
}
```
- Granularity options: `60`, `300`, `900`, `3600`, `7200`, `14400`, `86400`, `604800`, `2419200`

---

## Archive/Indexer API (Historical Data)

**Endpoint:** `POST [ARCHIVE_URL]` (always POST)
**Header required:** `Accept-Encoding: gzip, br, or deflate`

### Orders (Trade History)

```json
{
  "orders": {
    "subaccounts": ["0x<bytes32>"],
    "product_ids": [2],
    "max_time": 1700000000,
    "limit": 100
  }
}
```

**Response fields per order:**
- `digest` — unique order hash
- `product_id`, `subaccount`
- `amount` — original quantity (x18)
- `price_x18` — order price
- `base_filled`, `quote_filled` — execution totals
- `fee`, `builder_fee` — costs
- `realized_pnl` — P&L from closed portions
- `first_fill_timestamp`, `last_fill_timestamp`
- `expiration`, `nonce`, `appendix`

### Matches (Fill Details)

```json
{
  "matches": {
    "subaccounts": ["0x<bytes32>"],
    "product_ids": [2],
    "limit": 100
  }
}
```

**Response fields per match:**
- `base_filled`, `quote_filled` — amounts in this match
- `fee` — trading fees + sequencer fees
- `builder_fee`, `sequencer_fee` — broken out
- `cumulative_base_filled`, `cumulative_quote_filled`
- `is_taker` — taker (true) or maker (false)
- `pre_balance`, `post_balance`
- `submission_idx` — unique TX identifier

### Candlesticks

```json
{
  "candlesticks": {
    "product_id": 2,
    "granularity": 60,
    "max_time": 1700000000,
    "limit": 500
  }
}
```

**Response:** `open_x18`, `high_x18`, `low_x18`, `close_x18`, `volume` (all x18)

**Granularities:** `60`, `300`, `900`, `3600`, `7200`, `14400`, `86400`, `604800`, `2419200`

### Other Archive Endpoints

| Endpoint | Description |
|----------|-------------|
| `subaccounts` | List subaccounts by address |
| `subaccount-snapshots` | Historical subaccount state |
| `product-snapshots` | Product state over time |
| `market-snapshots` | TVL, volumes, open interest, funding, fees |
| `oracle-price` / `oracle-snapshots` | Oracle price data |
| `funding-rate` | Historical funding rates |
| `interest-and-funding-payments` | Funding payment history |
| `liquidation-feed` | Liquidation events |
| `linked-signers` | Linked signer history |
| `events` | General event log |

---

## Products & Markets

Query via `{ "type": "all_products" }` on Gateway.

### Known Product IDs

| ID | Type | Asset | Notes |
|----|------|-------|-------|
| 0 | Spot | USDT0 | Collateral token (6 decimals on-chain) |
| 1 | Spot | (Token) | First spot market |
| 2 | Perp | BTC-PERP | First perpetual |
| 3+ | Various | Various | Query `all_products` for full list |

### Product Specs (from `all_products` response)

Each product includes:
- `size_increment` — minimum lot step (x18)
- `price_increment_x18` — minimum tick (x18)
- `min_size` — minimum order size in quote (USDT0)
- Risk weights (long/short, initial/maintenance margins)
- Oracle price

---

## Number Encoding (x18 / x6)

**Almost everything in Nado uses x18 fixed-point math.**

| What | Encoding | Example |
|------|----------|---------|
| Prices | x18 | $30,000 → `"30000000000000000000000"` |
| Order amounts | x18 | 1 BTC → `"1000000000000000000"` |
| Position sizes | x18 | 0.5 BTC → `"500000000000000000"` |
| Fees | x18 | 0.1 USDT → `"100000000000000000"` |
| Funding rates | x18 | 24h annualized rate |
| Timestamps | nanoseconds | (in events/subscriptions) |
| **Withdraw amounts** | **raw token decimals** | 1 USDT0 → `"1000000"` (6 decimals) |
| **Deposit amounts** | **raw token decimals** | 1 USDT0 → `"1000000"` (6 decimals) |

### Conversion helpers

```ts
const X18 = BigInt(10) ** BigInt(18);

function toX18(value: number): string {
  return (BigInt(Math.round(value * 1e8)) * BigInt(10) ** BigInt(10)).toString();
}

function fromX18(x18: string): number {
  return Number(BigInt(x18)) / Number(X18);
}

// Price: $30,000 → "30000000000000000000000"
// Amount: 0.001 BTC → "1000000000000000"
// Amount: -0.5 BTC (SELL) → "-500000000000000000"
```

---

## Rate Limits

### Gateway

| Operation | Limit | Weight |
|-----------|-------|--------|
| Place order (with leverage) | 600/min or 10/sec per wallet | 1 |
| Place order (no leverage) | 30/min or 5/10sec per wallet | 20 |
| Cancel orders (no digests) | 600/min per wallet | 1 |
| Cancel orders (with digests) | 600/total_digests per min | total_digests |
| Withdraw (with leverage) | 60/min | 10 |
| Withdraw (no leverage) | 30/min | 20 |
| Link signer | 50 per 7 days per subaccount | 30 |
| Market price query | 2400/min per IP | 1 |
| All products query | 480/min per IP | 5 |
| Subaccount info | 1200/min per IP | 2 |
| Subaccount info + simulation | 240/min per IP | 10 |

### WebSocket

| Limit | Value |
|-------|-------|
| Connections per IP | 100 |
| Authenticated connections per wallet | 5 |
| Ping interval | Every 30 seconds |

### Archive

| Endpoint | Formula | Example (defaults) |
|----------|---------|-------------------|
| Orders | `2 + (limit * subaccounts / 20)` | ~200 req/min |
| Matches | `2 + (limit * subaccounts / 10)` | ~200 req/min |
| Candlesticks | `1 + limit / 20` | ~400 req/min |
| Subaccounts | Fixed weight 2 | 1200 req/min |
| Market snapshots | `max(count * products / 100, 2)` | varies |

### Trigger

- 25 pending trigger orders per product per subaccount

**General:** All endpoints enforce per-IP rate limiting. Responses include rate limit headers.

---

## Error Codes

### Error 2028 — Signature Mismatch

"Signature does not match with sender's or linked signer's"

**Causes:**
1. Wrong private key (not main wallet or linked signer)
2. Wrong chain ID (mainnet 57073 vs testnet 763373)
3. Wrong verifying contract (place_order uses `address(productId)`, others use endpoint)
4. Wrong data types in EIP-712 struct (e.g., sending string instead of uint64)

### Error 2024 — No Previous Deposits

"Provided address has no previous deposits" — subaccount doesn't exist yet.

**Causes:**
1. Never deposited or < $5 USDT0
2. Wrong network (testnet vs mainnet)
3. Wrong subaccount bytes32 encoding

### General Response Format

```json
{
  "status": "failure",
  "error": "human-readable message",
  "error_code": 2028,
  "request_type": "execute_place_order"
}
```

---

## SDK & Libraries

### TypeScript (recommended for TFC)

```bash
npm install @nadohq/client viem bignumber.js
```

### Python

```bash
pip install nado-protocol
```

### Rust

```bash
cargo add nado-sdk@0.3.3 ethers tokio
```

**SDK handles:** nonce generation, appendix encoding, EIP-712 signing, subaccount formatting, x18 conversions.

---

## TFC Integration Mapping

How Nado maps to TFC's exchange adapter pattern:

### Adapter Interface (`ExchangeAdapter`)

| TFC Method | Nado Implementation |
|------------|-------------------|
| `getPositions(account)` | Gateway query: `subaccount_info` → parse `perp_balances` |
| `getTradeHistory(params)` | Archive: `orders` or `matches` by subaccount |
| `getOpenOrders(account)` | Gateway query: `open_orders` or Archive: `orders` |
| `placeOrder(params)` | Gateway execute: `place_order` (EIP-712 signed) |
| `cancelOrder(params)` | Gateway execute: `cancel_orders` with digest |
| `cancelAllOrders(params)` | Gateway execute: `cancel_product_orders` |
| `getAccountSummary(account)` | Gateway query: `subaccount_info` → parse healths + balances |

### Order Router (`NadoOrderRouter`)

| TFC Order Type | Nado Appendix |
|----------------|---------------|
| Market (IOC) | `appendix = (1 << 9) \| 1` = `"513"` |
| Limit | `appendix = 1` = `"1"` |
| Post-Only | `appendix = (3 << 9) \| 1` = `"1537"` |
| Stop Market (trigger) | Trigger service: `price_trigger` + IOC appendix `"4609"` |
| Take Profit | Trigger service: `oracle_price_above/below` |
| Stop Loss | Trigger service: `oracle_price_below/above` |

### WebSocket Adapter (`NadoWsAdapter`)

| TFC Stream | Nado Stream |
|------------|-------------|
| Orderbook | `book_depth` (incremental) + `best_bid_offer` |
| Trades | `trade` |
| User fills | `fill` (per-subaccount) |
| Positions | `position_change` (per-subaccount) |
| Orders | `order_update` (requires auth) |
| Candles | `latest_candlestick` |

### Signing Pattern

Nado uses **linked signer** (similar to HL agent wallet):
1. User connects → frontend signs `link_signer` with main wallet
2. TFC generates linked signer key pair → stores encrypted in DB (`ExchangeConnection.agentPrivateKey`)
3. Server uses linked signer key for all trading operations
4. Main wallet can revoke via UI or API

### Key Differences from Other Exchanges

| Aspect | Pacifica | Hyperliquid | Nado |
|--------|----------|-------------|------|
| Auth model | Bearer token | Agent wallet (EIP-712) | Linked signer (EIP-712) |
| Account ID | Address | Address | Subaccount (bytes32) |
| Signing | Client-side | Server-side (agent) | Server-side (linked signer) |
| Number format | Normal | Normal | x18 fixed-point |
| TP/SL | Native API | Native API | Separate Trigger service |
| Order ID | Numeric | Numeric | Hex digest (bytes32) |
| WS orderbook | Full snapshots | Full snapshots | Incremental diffs |
| Chain | Pacifica | Arbitrum | Ink (L2) |
| Collateral | USDC | USDC | USDT0 |

### Critical Implementation Notes

1. **x18 math everywhere** — All prices and amounts need conversion. Use `BigInt` or `bignumber.js`, NOT floating point.
2. **Subaccount as account ID** — Store the full bytes32 subaccount (not just wallet address) in `ExchangeConnection.accountAddress`.
3. **Address case sensitivity** — Same EVM checksum issue as HL. Always `.toLowerCase()` before DB lookups.
4. **Order ID = digest** — The order digest (hex) is the unique ID. Store as string in `orderId` fields.
5. **Incremental orderbook** — Unlike Pacifica/HL that send snapshots, Nado sends diffs. WS adapter needs to maintain local book state.
6. **Trigger service is separate** — TP/SL orders go to a different endpoint than regular orders. Need separate handling in order router.
7. **Deposit creates subaccount** — User must deposit >= $5 USDT0 before any trading. Integration flow must handle this.
8. **Amount sign = direction** — Positive = BUY, Negative = SELL (unlike other exchanges that use separate side field).
