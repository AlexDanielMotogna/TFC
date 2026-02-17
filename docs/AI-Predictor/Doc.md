# AI Trading Signal — Complete System Documentation

## Overview

AI-powered **trading signal analyzer** that uses Claude (Anthropic) server-side to analyze real-time multi-timeframe market data and return actionable signals: **LONG**, **SHORT**, or **STAY OUT**, with exact entry, stop loss, take profit, leverage suggestion, and risk %.

Also provides per-position advice when the user has open positions (HOLD, CLOSE, ADD, REDUCE, MOVE_SL).

Users can **execute the AI's suggested order directly** from the widget with one click (market or limit), with TP/SL automatically placed.

A mandatory **legal disclaimer modal** must be accepted before first use, persisted in `localStorage`.

---

## Architecture

```
User clicks "Analyze"
        ↓
AiBiasWidget.tsx
  - Reads useAccount().positions → filters to current market → maps to OpenPosition[]
  - Calls useAiBias().analyze(symbol, riskProfile, relevantPositions)
        ↓
useAiBias hook → POST /api/ai/bias
  { symbol, riskProfile, openPositions }
        ↓
apps/web/src/app/api/ai/bias/route.ts
  - withAuth() → validate JWT token
  - Validate body (symbol, riskProfile)
  - Normalize symbol (e.g. "BTC" → "BTC-USD")
  - AiBiasService.getInstance().analyze(request)
        ↓
AiBiasService.ts (singleton orchestrator)
  1. Rate limit check (per userId, sliding window)
  2. Validate ANTHROPIC_API_KEY is set
  3. Fetch market data → MarketDataAggregator → PacificaProvider
  4. Cache check (60s TTL, hash-fingerprinted by market data)
  5. PromptBuilder → system prompt + user prompt w/ positions
  6. ClaudeClient.analyze() → claude-haiku-4-5-20251001
  7. AiResponseValidator.validate() → Zod schema + directional checks
  8. Cache result
  9. Log cost
        ↓
Response: AiSignalResponse
  → Widget renders LONG/SHORT/STAY OUT + levels + position advice
  → User optionally executes signal via useCreateMarketOrder / useCreateLimitOrder
```

---

## Files

### Types

**`apps/web/src/lib/ai/types/AiBias.types.ts`**

Core type definitions for the entire system.

```typescript
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';
export type SignalDirection = 'LONG' | 'SHORT' | 'STAY_OUT';
export type FactorBias = 'bullish' | 'bearish' | 'neutral';
export type PositionAction = 'HOLD' | 'CLOSE' | 'ADD' | 'REDUCE' | 'MOVE_SL';

export interface OpenPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  leverage: string;
  unrealizedPnl: string;
  liquidationPrice: string;
}

export interface PositionAdvice {
  symbol: string;
  action: PositionAction;
  detail: string;
}

export interface AiSignalResponse {
  signal: SignalDirection;
  confidence: number;         // 0-100
  entry: number;              // 0 for STAY_OUT
  stopLoss: number;           // 0 for STAY_OUT
  takeProfit: number;         // 0 for STAY_OUT
  suggestedLeverage: number;  // 0 for STAY_OUT
  riskPercent: number;        // 0 for STAY_OUT
  summary: string;
  riskProfile: RiskProfile;
  keyFactors: KeyFactor[];
  positionAdvice: PositionAdvice[];  // empty array if no open positions
  disclaimer: string;
  timestamp: number;
  expiresAt: number;
}

export interface AiBiasRequest {
  symbol: string;
  riskProfile: RiskProfile;
  userId: string;
  openPositions?: OpenPosition[];
}
```

---

### API Route

**`apps/web/src/app/api/ai/bias/route.ts`**

- `POST /api/ai/bias`
- Requires `Authorization: Bearer <token>` header
- Parses body **before** `withAuth()` (stream can only be consumed once)
- Validates: `symbol` (string), `riskProfile` (conservative | moderate | aggressive)
- Normalizes symbol: `"BTC"` → `"BTC-USD"`
- Extracts `openPositions` array from body and passes to service
- Maps `AiServiceError` codes to HTTP status codes:
  - `RATE_LIMITED` → 429
  - `AI_UNAVAILABLE` → 503
  - `INVALID_RESPONSE` → 502
  - `MARKET_DATA_ERROR` → 502
  - `VALIDATION_ERROR` → 500

**Request body:**
```json
{
  "symbol": "BTC-USD",
  "riskProfile": "moderate",
  "openPositions": [
    {
      "symbol": "BTC-USD",
      "side": "LONG",
      "size": "0.5",
      "entryPrice": "95000",
      "markPrice": "96500",
      "leverage": "5",
      "unrealizedPnl": "+750",
      "liquidationPrice": "88000"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": { ...AiSignalResponse }
}
```

---

### Service

**`apps/web/src/lib/ai/AiBiasService.ts`**

Singleton orchestrator. Module-level `instance` survives across serverless requests.

- Rate limit: `AI_RATE_LIMIT_MAX` env var (default `5`), sliding 60s window per userId
- Cache TTL: 60 seconds, keyed by `symbol+riskProfile`, invalidated when market data hash changes
- Passes `request.openPositions` to `PromptBuilder.buildUserPrompt()`
- Logs Claude token usage + estimated cost per call (Haiku 4.5 pricing: $0.80/M input, $4/M output)

**Environment variables:**
```
ANTHROPIC_API_KEY=sk-ant-...
AI_RATE_LIMIT_MAX=5          # optional, default 5
```

---

### Prompt Builder

**`apps/web/src/lib/ai/PromptBuilder.ts`**

Builds system + user prompts for Claude.

**System prompt rules:**
1. Output exactly one of: `LONG`, `SHORT`, `STAY_OUT`
2. For LONG/SHORT: provide exact entry, SL, TP, leverage, risk %
3. For STAY_OUT: set all numeric fields to 0
4. R:R ratio must be ≥ 1.5:1 — else output STAY_OUT
5. LONG: `stopLoss < entry < takeProfit`
6. SHORT: `takeProfit < entry < stopLoss`
7. Forbidden words: `guaranteed`, `will happen`, `definitely`, `certainly`, `risk-free`
8. If user has open positions → provide `positionAdvice` for EACH
9. If no open positions → `positionAdvice` must be `[]`
10. Output valid JSON only — no markdown, no text outside JSON

**Risk profile thresholds:**

| Profile | Indicators Required | Leverage | Risk/Trade | Min Confidence |
|---------|---------------------|----------|------------|----------------|
| Conservative | 3+ aligned | 1–3x | 1–2% | 70% |
| Moderate | 2+ aligned | 3–5x | 2–3% | 55% |
| Aggressive | 1 strong | 5–10x | 3–5% | 40% |

**Market data included in prompt:**
- Current price, mark price, 24h change, volume, open interest, funding rate
- 1H candles (last 20), 4H candles (last 10), 1D candles (last 7)
- Order book top 5 bids + asks
- All user open positions with symbol, side, size, entry, mark, leverage, PnL, liquidation

Prompt is safety-capped at 14,000 characters.

---

### Response Validator

**`apps/web/src/lib/ai/AiResponseValidator.ts`**

Parses and validates Claude's raw JSON string using Zod.

**Steps:**
1. Extract JSON — handles raw JSON, markdown code blocks, embedded JSON in text
2. Parse with `JSON.parse()`
3. Validate with Zod schema (`AiSignalResponseSchema` + `PositionAdviceSchema`)
4. Verify `riskProfile` in response matches request
5. Check forbidden words in `summary` and `keyFactors.detail`
6. Directional validation:
   - `LONG`: `stopLoss < entry` AND `takeProfit > entry`
   - `SHORT`: `stopLoss > entry` AND `takeProfit < entry`
   - `STAY_OUT`: skip (all zeros allowed)
7. Enrich with `timestamp` and `expiresAt` (now + 60s)

**Zod schema highlights:**
- `confidence`: integer 0–100
- `suggestedLeverage`: 0–10
- `riskPercent`: 0–10
- `keyFactors`: 1–10 items
- `positionAdvice`: 0–20 items, each with `action` enum

---

### Cache Manager

**`apps/web/src/lib/ai/cache/CacheManager.ts`**

In-memory cache with TTL + data hash fingerprinting.

- Cache key: `symbol:riskProfile` (e.g. `BTC-USD:moderate`)
- Data hash: MD5 of the market data bundle — cache is invalidated if data changes even within TTL
- TTL: 60 seconds

---

### Rate Limiter

**`apps/web/src/lib/ai/security/RateLimiter.ts`**

Sliding window rate limiter per userId.

- Default: 5 requests per 60 seconds
- Configurable via `AI_RATE_LIMIT_MAX` env var
- Returns `{ allowed: boolean, retryAfter?: number }`
- On limit hit: throws `AiServiceError` with `code: 'RATE_LIMITED'` and `retryAfter` seconds

---

### Claude Client

**`apps/web/src/lib/ai/ClaudeClient.ts`**

Wrapper around `@anthropic-ai/sdk`.

- Model: `claude-haiku-4-5-20251001`
- Has circuit breaker pattern for API failures
- Returns `{ content: string, inputTokens: number, outputTokens: number, model: string }`

---

### Market Data

**`apps/web/src/lib/ai/market/MarketDataAggregator.ts`**
**`apps/web/src/lib/ai/market/PacificaProvider.ts`**
**`apps/web/src/lib/ai/market/IMarketDataProvider.ts`**

Interface + adapter pattern. `PacificaProvider` implements `IMarketDataProvider` and fetches:
- Market snapshot (price, funding, OI, volume)
- 1H, 4H, 1D candles
- Order book top 10

`MarketDataAggregator` accepts an array of providers (multi-exchange ready).

---

### Frontend Hook

**`apps/web/src/hooks/useAiBias.ts`**

```typescript
const { data, isLoading, error, analyze, clear, isExpired } = useAiBias();

// Trigger analysis with optional open positions
analyze(symbol, riskProfile, openPositions?);

// isExpired: true when Date.now() > data.expiresAt
```

- Abort controller prevents race conditions when analyze is called multiple times
- Rate limit 429 response shows `retryAfter` seconds in error message
- Auth token read from Zustand `useAuthStore.getState().token`

---

### Widget

**`apps/web/src/components/AiBiasWidget.tsx`**

Professional floating panel on the trade page. Width: `xl:w-[400px]`.

**Props:**
```typescript
interface AiBiasWidgetProps {
  selectedMarket: string;   // e.g. "BTC-USD"
  currentPrice: number;     // current mark price (unused directly, positions use getPrice())
  tvWidget?: ChartWidget | null;  // TradingView widget for chart line drawing
}
```

**UI Structure:**
```
[FAB — shows signal color/label when panel closed]
─── Panel ───
[Header: orb + "AI Signal" + market + close]
[Risk pills: Safe | Balanced | Aggro]
[N open positions detected — current market only]
[Analyze {symbol} button]
[Error banner]
─── when data present ───
[Signal badge pill: ↑ LONG (green) / ↓ SHORT (red) / — STAY OUT (gray)]
[Confidence bar: green ≥70%, yellow 40–69%, red <40%]
[Tabs: SIGNAL | FACTORS | POS(n)]
───── SIGNAL tab ─────
[2×3 data grid: ENTRY / STOP / TARGET / LEVERAGE / RISK / R:R]
[Summary text — italic, muted]
[Execute Signal section — LONG/SHORT only, not expired]
  [Market | Limit pills]
  [Size / Position value / Est. TP gain / Est. SL loss]
  [Execute → Confirm → Pending → Success | Error]
[Copy Levels button]
[Expiry countdown bar]
[Footer disclaimer]
───── FACTORS tab ─────
[keyFactors list: bias dot + factor name + detail]
───── POS tab ─────
[positionAdvice cards: action badge + symbol + detail]
```

**Position filtering:**
- Only positions matching `selectedMarket` are sent to AI (e.g. BTC-USD analysis only sends BTC-USD position)
- Mark price per position injected from `usePrices().getPrice(symbol)` for accurate PnL

**Chart line drawing:**
- When signal arrives (`LONG`/`SHORT`), draws 3 horizontal lines on the TradingView chart via `tvWidget.activeChart().createShape()`
- Entry → white/gray, Stop Loss → red, Take Profit → green
- Lines removed when widget closes or market changes
- Silently fails if chart API unavailable (fallback: Copy button)
- Header shows a `· chart` indicator when lines are drawn

**Order execution flow:**

```
User selects Market or Limit mode
        ↓
Size calculated: riskUSD = availableToSpend × riskPercent%
                 amount = calculateOrderAmount({ riskUSD, leverage, maxLeverage, price, lotSize })
                 TP/SL prices rounded via roundToTickSize()
        ↓
[Execute Signal] → [Confirm card] → [Confirm & Sign] → wallet signs → Pacifica API
        ↓
Success: TP/SL orders active
Error: error message shown, Try Again available
```

**Order amount rounding:**
- Uses `calculateOrderAmount()` from `lib/trading/utils.ts` — floors to lot size (e.g. SOL lot_size=0.01 → `"0.02"` not `"0.02400"`)
- Uses `roundToTickSize()` for entry, TP, SL prices
- `lotSize` and `tickSize` sourced from `usePrices().getPrice(selectedMarket)` (fetched from Pacifica `/api/v1/info`)

**Symbol format:**
- Widget sends `symbol = selectedMarket.replace('-USD', '')` (e.g. `"SOL"` not `"SOL-USD"`) to match Pacifica order API format

**Action colors:**
| Action | Color |
|--------|-------|
| HOLD | gray |
| CLOSE | red |
| ADD | green |
| REDUCE | yellow |
| MOVE SL | blue |

**Position mapping (Pacifica → AI format):**
- `side: 'bid'` → `'LONG'`
- `side: 'ask'` → `'SHORT'`
- Uses `useAccount()` hook (positions from WebSocket + HTTP polling dual-layer)

---

### Disclaimer Modal

**`apps/web/src/components/AiDisclaimerModal.tsx`**

Non-dismissable modal (no backdrop click to close).

- Shows on first Analyze click
- Must click "I Understand and Accept" to proceed
- Acceptance persisted: `localStorage.setItem('tfc-ai-disclaimer-accepted', 'true')`
- 4 bullet points:
  1. 100% user responsibility for all trading decisions
  2. Analyzes publicly available market data only — no guaranteed outcomes
  3. Not financial advice — past patterns don't predict future results
  4. Leverage trading carries significant risk of total loss

---

### TradingView Integration

**`apps/web/src/components/TradingViewChartAdvanced.tsx`**

Added `onWidgetReady` prop to expose the widget instance externally:

```typescript
interface TradingViewChartAdvancedProps {
  // ... existing props ...
  onWidgetReady?: (widget: ChartWidget) => void;
}

export interface ChartWidget {
  // ... existing ...
  activeChart: () => {
    createStudy: (...) => Promise<unknown>;
    crossHairMoved: () => ISubscription<...>;
    createShape: (point: { time: number; price: number }, options: Record<string, unknown>) => unknown;
    removeAllShapes: () => void;
  };
}
```

Follows the existing callback ref pattern (like `onQuickOrder`/`onSymbolChange`) to avoid stale closures. Called after chart initialization inside `onChartReady`.

**`apps/web/src/app/trade/page.tsx`**

Stores widget via `useState<ChartWidget | null>(null)`, passes to both chart instances (mobile + desktop) via `onWidgetReady={setTvWidget}`, then passes to `<AiBiasWidget tvWidget={tvWidget} />`.

---

## Signal Flow with Open Positions

```
User has BTC-USD LONG open @ $95,000
        ↓
Widget detects: "1 BTC position detected"
        ↓
Analyze clicked → sends position data in POST body
        ↓
Claude receives: BTC-USD LONG | Size: 0.5 | Entry: $95,000 | Mark: $96,500 | Lev: 5x | PnL: +$750 | Liq: $88,000
        ↓
Claude returns signal + positionAdvice:
  [{ symbol: "BTC-USD", action: "MOVE_SL", detail: "Move stop loss to $95,500 to lock in profits" }]
        ↓
Widget renders Position Advice section with MOVE SL badge in blue
```

## Order Execution Flow

```
Signal: LONG BTC-USD | Entry: $95,200 | SL: $92,000 | TP: $100,000 | Lev: 5x | Risk: 2%
        ↓
Available balance: $1,000
riskUSD = $1,000 × 2% = $20
positionValue = $20 × 5 = $100
amount = calculateOrderAmount({ positionSize: $20, leverage: 5, maxLeverage: 50, price: $95,200, lotSize: 0.00001 })
       = "0.00104" BTC
entryStr = roundToTickSize(95200, 1) = "95200"
tpStr   = roundToTickSize(100000, 1) = "100000"
slStr   = roundToTickSize(92000, 1) = "92000"
        ↓
Market order: { symbol: "BTC", side: "bid", amount: "0.00104", take_profit: { stop_price: "100000" }, stop_loss: { stop_price: "92000" } }
```

---

## Cost & Limits

| Parameter | Value |
|-----------|-------|
| Model | claude-haiku-4-5-20251001 |
| Rate limit | 5 req/min/user (configurable via `AI_RATE_LIMIT_MAX`) |
| Cache TTL | 60 seconds per symbol+riskProfile |
| Signal TTL | 60 seconds (shown as countdown in UI) |
| Est. cost | ~$0.001 per analysis call |
| Prompt cap | 14,000 characters |

---

## Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...      # Required
AI_RATE_LIMIT_MAX=5               # Optional, default 5 req/min/user
```

---

## Verification Checklist

- [ ] First "Analyze" click → disclaimer modal appears, must accept
- [ ] Subsequent visits → disclaimer skipped (localStorage persists)
- [ ] With wallet connected and positions open → chip shows "N {symbol} position detected" (current market only)
- [ ] Analysis returns LONG/SHORT/STAY_OUT with entry, SL, TP, leverage, risk
- [ ] With open positions → Position Advice section appears with color-coded actions
- [ ] STAY_OUT → signal levels section hidden, placeholder shown
- [ ] All 3 risk profiles work (conservative gives wider stops + lower leverage)
- [ ] Confidence bar color-codes correctly (green/yellow/red)
- [ ] Expiry countdown runs from 60s → 0s with color change
- [ ] After expiry → "Signal expired — re-analyze" shown, Execute section hidden
- [ ] 6th request within 1 minute → rate limit error with retry countdown
- [ ] Without `ANTHROPIC_API_KEY` → graceful "AI analysis not configured" error
- [ ] Forbidden words (`guaranteed`, `risk-free`, etc.) → validation error, not shown to user
- [ ] LONG signal: Execute section visible, green button "↑ Execute LONG Signal"
- [ ] SHORT signal: Execute section visible, red button "↓ Execute SHORT Signal"
- [ ] Execute → Confirm card shows amount/TP/SL/leverage note
- [ ] Market order amount is a valid lot_size multiple (e.g. "0.02" not "0.02400" for SOL)
- [ ] TP/SL stop prices are valid tick_size multiples
- [ ] Confirm & Sign → wallet popup → order submitted → success card
- [ ] Chart lines drawn (entry white, SL red, TP green) when LONG/SHORT signal
- [ ] "· chart" indicator appears in header when lines active
- [ ] Lines removed when panel closed or market changes
- [ ] Factors tab → key factors with bias dots
- [ ] POS tab → position advice cards or empty state
- [ ] Changing market → resets to SIGNAL tab, clears exec state
