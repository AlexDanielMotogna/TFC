# Features To Add

## 1. Stop Market & Stop Limit Orders (Standalone)

**Status:** UI exists, backend NOT implemented

**Current State:**
- The order type dropdown shows: Market, Limit, Stop Market, Stop Limit
- Selecting Stop Market/Stop Limit shows error: "Stop orders coming soon"
- Code location: `apps/web/src/app/trade/page.tsx:273-276`

**Implementation Required:**

### Backend (`apps/web/src/app/api/orders/route.ts`)
1. Add handling for `type === 'STOP_MARKET'` and `type === 'STOP_LIMIT'`
2. Use Pacifica endpoint: `/api/v1/orders/create` with `stop_price` parameter
3. For STOP_LIMIT: include both `stop_price` (trigger) and `price` (limit)
4. Record as `actionType: 'STOP_MARKET_ORDER'` or `actionType: 'STOP_LIMIT_ORDER'` in TfcOrderAction

### Frontend (`apps/web/src/app/trade/page.tsx`)
1. Remove the "coming soon" error (lines 273-276)
2. Pass `triggerPrice` to the API
3. Call appropriate mutation based on order type

### Schema (`packages/db/prisma/schema.prisma`)
1. Add to OrderActionType enum:
   - `STOP_MARKET_ORDER`
   - `STOP_LIMIT_ORDER`

### Fight Only Filter
1. Update `/api/fights/[id]/orders` to include new action types
2. Update `/api/fights/[id]/order-history` to include new action types

---

## 2. Fight Only Trading Tools

**Question:** Is it possible to add all trading functions (flip, market, limit, sl/tp) that work ONLY with fight positions?

**Scenario:**
- User has pre-fight BTC position (100 BTC)
- User opens new BTC position during fight (50 BTC)
- Fight Only view shows only the 50 BTC fight position
- Trading tools (flip, close, TP/SL) should operate ONLY on the 50 BTC fight portion

**Complexity:** HIGH - requires separating position management by fight context

---

