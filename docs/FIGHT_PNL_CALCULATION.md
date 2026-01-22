# Fight PnL Calculation Algorithm

This document describes how the fight PnL percentage (shown as "You" and "Opp" in the navbar) is calculated during live fights.

> **Reference**: This implementation follows [Fight-Engine_Rules.md](./Fight-Engine_Rules.md) Rules 18-25.

## Key Rules Summary

Per **Fight-Engine_Rules.md**:

| Rule | Description |
|------|-------------|
| **18** | PnL is calculated ONLY from valid fight trades (completely closed) |
| **19** | Open positions do NOT generate PnL |
| **20** | If fight ends with open positions, those are NOT included in PnL |
| **21** | For valid PnL, all positions must be closed before endTime |
| **22-25** | PnL includes all trading fees (Pacifica + 0.05% platform fee) |
| **30-32** | 30-second warning before fight ends |

## Core Formula

```
pnlPercent = (realizedPnl / effectiveMargin) * 100
```

Where:
- **realizedPnl** = Sum of PnL from CLOSING trades only (opening trades don't count!)
- **effectiveMargin** = currentMargin > 0 ? currentMargin : maxExposureUsed

## Critical: Only CLOSING Trades Count

This is the most important rule. Opening a position does NOT contribute to fight PnL.

### What Counts as a CLOSING Trade?

| Current Position | Trade Side | Result |
|-----------------|------------|--------|
| LONG (amount > 0) | SELL | Closing LONG - **PnL COUNTS** |
| SHORT (amount < 0) | BUY | Closing SHORT - **PnL COUNTS** |
| None or LONG | BUY | Opening/increasing LONG - **PnL = 0** |
| None or SHORT | SELL | Opening/increasing SHORT - **PnL = 0** |

### Example: Opening Position

```typescript
// User opens a LONG position
Trade: { side: 'BUY', amount: 0.001, price: 50000, pnl: -0.05 (fee) }

// Fight PnL calculation:
realizedPnl = 0  // Opening trade - doesn't count!
pnlPercent = 0%
```

### Example: Closing Position

```typescript
// User has LONG 0.001 BTC, now closes it
Trade: { side: 'SELL', amount: 0.001, price: 51000, pnl: +0.95 }

// Fight PnL calculation:
realizedPnl = 0.95  // Closing trade - COUNTS!
pnlPercent = (0.95 / margin) * 100
```

## Detailed Calculation Logic

### 1. Process Trades Chronologically

```typescript
for (const trade of fightTrades) {
  if (trade.side === 'BUY') {
    if (positionsBySymbol[symbol].amount < 0) {
      // CLOSING SHORT - this pnl counts!
      const closeAmount = Math.min(amount, Math.abs(currentShort));
      realizedPnl += trade.pnl * (closeAmount / amount);
    } else {
      // OPENING LONG - pnl doesn't count
    }
  } else { // SELL
    if (positionsBySymbol[symbol].amount > 0) {
      // CLOSING LONG - this pnl counts!
      const closeAmount = Math.min(amount, currentLong);
      realizedPnl += trade.pnl * (closeAmount / amount);
    } else {
      // OPENING SHORT - pnl doesn't count
    }
  }
}
```

### 2. Partial Close Handling

When a trade partially closes and partially opens a position:

```typescript
// User has LONG 0.001, sells 0.002 (closes 0.001, opens SHORT 0.001)
Trade: { side: 'SELL', amount: 0.002, pnl: 0.90 }

// Only the closing portion (0.001/0.002 = 50%) counts
realizedPnl += 0.90 * 0.5  // = 0.45
```

### 3. Margin Fallback (maxExposureUsed)

When all positions are closed, `margin = 0`. To show ROI%, we use `maxExposureUsed`:

```typescript
const effectiveMargin = margin > 0 ? margin : maxExposureUsed;
const pnlPercent = effectiveMargin > 0 ? (realizedPnl / effectiveMargin) * 100 : 0;
```

## Fight Ending Scenarios

### Scenario 1: Position Closed Before Fight Ends

```
1. Open LONG BTC at 50000 (pnl = -fee, doesn't count)
2. Close LONG BTC at 51000 (pnl = +$0.95, COUNTS!)
3. Fight ends

Result: pnlPercent = (+0.95 / maxExposureUsed) * 100
```

### Scenario 2: Position Open When Fight Ends (BAD!)

```
1. Open LONG BTC at 50000 (pnl = -fee, doesn't count)
2. Fight ends with position still open

Result: pnlPercent = 0%  // Open position doesn't count!
```

**This is why we send a 30-second warning!**

## 30-Second Warning (Rules 30-32)

At 30 seconds before fight ends:

```typescript
// Backend emits
this.io.to(`fight:${fightId}`).emit('FIGHT_ENDING_SOON', {
  fightId,
  secondsRemaining: 30,
  message: 'Close all positions now! Open positions will NOT count.',
});

// Frontend shows notification
notify('FIGHT', '30 seconds remaining!',
  'Close all positions now! Open positions will NOT count towards your final score.',
  { variant: 'warning' }
);
```

## Fees Impact (Rules 22-25)

Trading fees are included in realized PnL when positions are closed.

### Dynamic Fee Rates from Pacifica API

**Important:** Pacifica fees are **NOT hardcoded**. They are fetched dynamically from the Pacifica API because Pacifica adjusts their fee rates periodically (typically monthly).

| Fee Type | Source | Notes |
|----------|--------|-------|
| Pacifica Maker Fee | `/api/v1/account` → `maker_fee` | Dynamic, changes monthly |
| Pacifica Taker Fee | `/api/v1/account` → `taker_fee` | Dynamic, changes monthly |
| Platform Fee | TradeFightClub | Fixed at 0.05% |

### Example Rates (as of Jan 2026)

These are **example values** that may change:

| Fee Type | Example Rate |
|----------|--------------|
| Pacifica Maker | 0.0575% |
| Pacifica Taker | 0.07% |
| Platform Fee | 0.05% |

### How Fees Are Retrieved (Rules 26-29)

Per Fight-Engine_Rules.md:

1. Platform calls Pacifica API `/api/v1/account`
2. Response includes `maker_fee` and `taker_fee` fields
3. These real values are used in PnL calculations
4. Fee calculation is based on **actual data from Pacifica**, not estimates

```typescript
// Example API response from Pacifica
{
  "maker_fee": "0.000575",  // 0.0575%
  "taker_fee": "0.0007",    // 0.07%
  // ... other account data
}
```

This ensures PnL calculations remain accurate even when Pacifica updates their fee structure.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  FightTrade DB  │───▶│  Fight Engine   │                     │
│  │  (Closed Only)  │    │  (Calculation)  │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│            PNL_TICK (every 1s) + FIGHT_ENDING_SOON (at 30s)     │
│                                  │                               │
└──────────────────────────────────┼──────────────────────────────┘
                                   │
                            WebSocket
                                   │
┌──────────────────────────────────┼──────────────────────────────┐
│                         FRONTEND │                               │
│                                  ▼                               │
│                    ┌─────────────────────┐                      │
│                    │    useSocket.ts     │                      │
│                    │ (Listens for events)│                      │
│                    └──────────┬──────────┘                      │
│                               │                                  │
│               ┌───────────────┴───────────────┐                 │
│               ▼                               ▼                  │
│    ┌─────────────────────┐         ┌─────────────────────┐     │
│    │   FightBanner.tsx   │         │  notify() warning   │     │
│    │  You: +1.25%        │         │  "30 seconds left!" │     │
│    └─────────────────────┘         └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## WebSocket Events

### PNL_TICK

Sent every second during live fights:

```typescript
{
  fightId: string;
  timestamp: number;
  participantA: {
    userId: string;
    pnlPercent: number;    // Only from CLOSED positions
    scoreUsdc: number;     // USD amount
    tradesCount: number;
  };
  participantB: { ... };
  leader: string | null;
  timeRemainingMs: number;
}
```

### FIGHT_ENDING_SOON

Sent once, 30 seconds before fight ends:

```typescript
{
  fightId: string;
  secondsRemaining: number;  // 30
  message: string;
}
```

## Unit Tests

The PnL calculation logic is tested in:

```
apps/realtime/src/fight-pnl-calculator.test.ts
```

Run tests with:

```bash
cd apps/realtime
npm test
```

Tests cover:
- Opening trades don't count for PnL
- Closing trades do count
- Partial closes count proportionally
- Position flips (close + open)
- maxExposureUsed fallback
- Real bug scenarios

## File Locations

| Component | File Path |
|-----------|-----------|
| Backend Calculation | `apps/realtime/src/fight-engine.ts` |
| PnL Calculator (testable) | `apps/realtime/src/fight-pnl-calculator.ts` |
| Unit Tests | `apps/realtime/src/fight-pnl-calculator.test.ts` |
| Frontend Display | `apps/web/src/components/FightBanner.tsx` |
| WebSocket Hook | `apps/web/src/hooks/useSocket.ts` |
| Rules Document | `docs/Fight-Engine_Rules.md` |

## Win/Lose Determination

At fight end:
- **Winner**: Higher `pnlPercent`
- **Draw**: Difference < `EPSILON` (0.0001%)
- Both users with 0 trades = **Draw** (both have 0%)
- User A: 0 trades, User B: open position not closed = **Draw** (both have 0%)

## Common Mistakes

### 1. Expecting PnL from open positions

**Wrong**: "I opened a position and it shows +5% unrealized, why is fight PnL 0%?"

**Answer**: Per Rules 18-21, only CLOSED positions count. Close the position to lock in PnL.

### 2. Not closing before fight ends

**Wrong**: "I had profit but fight ended and I got 0%"

**Answer**: You must close positions before fight ends. The 30-second warning reminds you.

### 3. Opening fee counts as loss

**Wrong**: "I just opened a position and I'm already losing"

**Answer**: Opening fees don't count for fight PnL. Only closing trade PnL counts.

## Related Documentation

- [Fight Engine Rules](./Fight-Engine_Rules.md) - The authoritative rules
- [Master Doc](./Master-doc.md) - Overall system documentation
