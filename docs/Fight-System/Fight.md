# Fix: Limit/Stop Order Fills Not Tracked During Fights

## Context
When a user places a **limit**, **stop market**, or **stop limit** order during a fight, only a `TfcOrderAction` record is created. Unlike market orders (which execute immediately and trigger `recordAllTrades()` → creates `Trade` + `FightTrade` records), these deferred orders have **no mechanism to detect when they fill**.

This means filled limit/stop orders during fights:
1. Don't count in **Fight Capital** (exposure not tracked)
2. Don't count in **PnL** calculation (FightTrade missing)
3. Don't appear in **Trade History** fight-only mode

**Root cause**: `orders/route.ts` line 284: `if (type === 'MARKET' && result.data?.order_id)` — only market orders call `recordAllTrades()`.

## Architecture: Internal API + Fill Detector

Follow the existing pattern where fight-engine calls internal web API endpoints (same as anti-cheat settle at `POST /api/internal/anti-cheat/settle`).

### Flow
```
fight-engine tick loop (every 5s)
  → FillDetector.checkForFilledOrders()
    → Query TfcOrderAction for pending LIMIT_ORDER/CREATE_STOP with pacificaOrderId
    → Fetch Pacifica trade history for participants with pending orders
    → Match fills by order_id
    → POST /api/internal/record-fill (web app)
      → recordAllTrades() (reuses ALL existing logic: Rule 35, exposure, PnL, websocket)
```

## Implementation Steps

### Step 0: Fix stake limit validation to account for pending orders

**Modify**: `apps/web/src/lib/server/orders.ts` — `validateStakeLimit()`

**Problem**: Currently `validateStakeLimit` only checks `currentExposure` from FightTrade records (executed trades). Pending limit/stop orders are invisible — you can place 11x $10 limit orders on a $100 stake because each one sees "$100 available".

**Fix**: After calculating `currentExposure`, also calculate `pendingOrderNotional` — the sum of notional value from open orders placed during this fight:

```typescript
// Get open orders from Pacifica that were placed during this fight
const openOrders = await getOpenOrders(accountAddress); // from pacifica.ts
const fightOrderActions = await prisma.tfcOrderAction.findMany({
  where: {
    fightId: activeFight.fightId,
    userId,
    actionType: { in: ['LIMIT_ORDER', 'CREATE_STOP'] },
    pacificaOrderId: { not: null },
    success: true,
  },
});
const fightOrderIds = new Set(fightOrderActions.map(a => a.pacificaOrderId!.toString()));

// Sum notional of pending fight orders (not yet filled)
const pendingNotional = openOrders
  .filter(o => fightOrderIds.has(o.order_id?.toString()))
  .reduce((sum, o) => sum + parseFloat(o.amount) * parseFloat(o.price), 0);

// Available = stake - maxExposureUsed + currentExposure - pendingNotional
const availableCapital = calculateAvailableCapital(stake, maxExposureUsed, currentExposure) - pendingNotional;
```

Also add `validateStakeLimit` call to `apps/web/src/app/api/orders/stop/create/route.ts` (currently has **no** stake validation).

### Step 1: Extract trade recording into shared module

**Move from** `apps/web/src/app/api/orders/route.ts` **to** `apps/web/src/lib/server/trade-recording.ts`:
- `recordAllTrades()` (lines 341-547)
- `recordFightTradeWithDetails()` (lines 568-968)
- `InitialPosition` and `ExecutionDetails` interfaces
- Related helper imports

Update `orders/route.ts` to import from the new module.

### Step 2: Create internal API endpoint

**New file**: `apps/web/src/app/api/internal/record-fill/route.ts`

Follow pattern from `apps/web/src/app/api/internal/anti-cheat/settle/route.ts`:
- Validate `X-Internal-Key` header
- Accept: `{ accountAddress, symbol, side, amount, orderId, historyId, executionPrice, fee, pnl, fightId, leverage }`
- Call `recordAllTrades()` passing pre-fetched execution details
- Handle P2002 duplicate gracefully (return success)

### Step 3: Create fill detector module

**New file**: `apps/realtime/src/fill-detector.ts`

Core logic:
1. Get pending order actions (LIMIT_ORDER, CREATE_STOP) with `pacificaOrderId` for each fight
2. Skip fights with no pending orders (optimization)
3. For participants with pending orders → fetch `getTradeHistory()` from Pacifica (already exists in `pacifica-client.ts`)
4. Match `trade.order_id` against `TfcOrderAction.pacificaOrderId`
5. Check `FightTrade` table for existing `pacificaHistoryId` (dedup)
6. POST to `/api/internal/record-fill` with fill details + leverage from original action

**Deduplication** (3 layers):
1. In-memory `processedHistoryIds` set
2. `FightTrade` table check before calling API
3. `Trade` table `@@unique([pacificaHistoryId])` constraint

**TP/SL fills**: `SET_TPSL` orders don't have `pacificaOrderId`. Match by symbol + trade `cause` containing "stop_loss"/"take_profit" + not yet recorded.

### Step 4: Integrate into fight engine tick loop

**Modify**: `apps/realtime/src/fight-engine.ts`

```typescript
const FILL_CHECK_INTERVAL = 5; // Every 5 ticks (5 seconds)
if (this.tickCount % FILL_CHECK_INTERVAL === 0) {
  this.fillDetector.checkForFilledOrders(liveFights).catch(err => {
    logger.error(LOG_EVENTS.API_ERROR, 'Fill detection failed', err);
  });
}
```

Fire-and-forget — never blocks the tick loop.

## Files Modified/Created

| File | Action |
|------|--------|
| `apps/web/src/lib/server/trade-recording.ts` | **NEW** — Extracted from orders/route.ts |
| `apps/web/src/app/api/orders/route.ts` | **MODIFY** — Import from trade-recording.ts |
| `apps/web/src/app/api/internal/record-fill/route.ts` | **NEW** — Internal API endpoint |
| `apps/realtime/src/fill-detector.ts` | **NEW** — Fill detection logic |
| `apps/realtime/src/fight-engine.ts` | **MODIFY** — Integrate fill detector |
| `apps/web/src/app/api/fights/[id]/orders/route.ts` | **ALREADY DONE** — Added CREATE_STOP |

## Verification

1. Place a limit order during a fight → wait for fill → verify FightTrade created
2. Fight Capital updates after limit fill (exposure + maxExposureUsed)
3. PnL includes the filled limit order
4. Trade History fight-only shows the fill
5. Stop market order → trigger → verify same behavior
6. Same fill detected twice → no duplicate records
7. Order fills after fight ends → NOT recorded
8. `npm run build` — no errors in both web and realtime apps
