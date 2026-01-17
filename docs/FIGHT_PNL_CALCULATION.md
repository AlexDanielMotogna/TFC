# Fight PnL Calculation Algorithm

This document describes how the fight PnL percentage (shown as "You" and "Opp" in the navbar) is calculated during live fights.

## Overview

The PnL calculation happens on the **backend** (fight-engine) to ensure consistency between both clients. Updates are sent via WebSocket every second.

## Core Formula

```
pnlPercent = (totalPnL / margin) * 100
```

Where:
- **totalPnL** = realizedPnl + unrealizedPnL
- **margin** = sum of (positionValue / leverage) for all open positions

## Detailed Calculations

### 1. Realized PnL

Sum of all closed position PnLs (already includes trading fees):

```typescript
const realizedPnl = trades.reduce((sum, t) => sum + (t.pnl ? Number(t.pnl) : 0), 0);
```

### 2. Unrealized PnL

For each symbol with open positions:

```typescript
unrealizedPnL = (markPrice - avgEntryPrice) * netAmount
```

- **LONG** (amount > 0): profit when price goes UP
- **SHORT** (amount < 0): profit when price goes DOWN

### 3. Margin Calculation

```typescript
margin = positionValue / leverage
```

- Uses `leverage` from trade data
- Falls back to `MAX_LEVERAGE[symbol]` if not specified:
  - BTC: 50x
  - ETH: 50x
  - SOL: 10x

### 4. Final PnL Percentage

```typescript
const totalPnl = realizedPnl + unrealizedPnl;
const pnlPercent = margin > 0 ? (totalPnl / margin) * 100 : 0;
```

## Example Calculation

Given:
- Fight stake: $250
- Position: BTC Long 9x leverage
- Position Value: $35.15
- Entry Price: $94,971
- Mark Price: $94,987
- No previous trades (realizedPnl = 0)

**Step 1: Calculate Margin**
```
margin = $35.15 / 9 = $3.906
```

**Step 2: Calculate Unrealized PnL**
```
priceChange = ($94,987 - $94,971) / $94,971 = 0.0001684 (0.01684%)
unrealizedPnL = $35.15 * 0.0001684 = $0.00592
```

**Step 3: Calculate PnL Percentage**
```
totalPnL = $0 + $0.00592 = $0.00592
pnlPercent = ($0.00592 / $3.906) * 100 = 0.1515%
```

## Important Notes

### Fees Impact

Trading fees are included in realized PnL when positions are closed:
- **Taker fee**: 0.07% (0.02% Pacifica + 0.05% TFC)
- **Maker fee**: 0.0575% (0.0075% Pacifica + 0.05% TFC)

Example: Opening a $35 position costs ~$0.025 in fees.

### Why Fight PnL May Differ from Position PnL

The fight PnL can be negative even with a profitable open position because:

1. **Previous closed trades** with losses
2. **Accumulated fees** from multiple trades
3. **Different base**: Position ROI uses position value, Fight PnL uses total margin

### Float Tolerance

Uses `EPSILON = 0.0001` to determine draws and avoid UI flickering from float precision errors.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Pacifica API   │───▶│  Fight Engine   │                     │
│  │  (Live Prices)  │    │  (Calculation)  │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│                         PNL_TICK (every 1s)                      │
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
│                    │  (WebSocket Hook)   │                      │
│                    └──────────┬──────────┘                      │
│                               │                                  │
│                               ▼                                  │
│                    ┌─────────────────────┐                      │
│                    │     store.ts        │                      │
│                    │   (FightStore)      │                      │
│                    └──────────┬──────────┘                      │
│                               │                                  │
│                               ▼                                  │
│                    ┌─────────────────────┐                      │
│                    │   FightBanner.tsx   │                      │
│                    │  (Navbar Display)   │                      │
│                    └─────────────────────┘                      │
│                               │                                  │
│                               ▼                                  │
│                    ┌─────────────────────┐                      │
│                    │  You: -0.4788%      │                      │
│                    │  Opp: +0.0000%      │                      │
│                    └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

## File Locations

| Component | File Path |
|-----------|-----------|
| Backend Calculation | `apps/realtime/src/fight-engine.ts` |
| Frontend Display | `apps/web/src/components/FightBanner.tsx` |
| WebSocket Hook | `apps/web/src/hooks/useSocket.ts` |
| State Management | `apps/web/src/lib/store.ts` |
| Global Arena Updates | `apps/web/src/hooks/useGlobalSocket.ts` |

## WebSocket Events

### PNL_TICK

Sent every second during live fights:

```typescript
{
  fightId: string;
  participants: [
    {
      userId: string;
      handle: string;
      pnlPercent: number;    // Displayed in navbar
      scoreUsdc: number;     // USD amount
      tradesCount: number;
    },
    // ... opponent
  ]
}
```

### arena:pnl_tick

Broadcast to all connected clients for live fight cards:

```typescript
{
  fightId: string;
  scores: ParticipantScore[];
}
```

## Win/Lose Determination

At fight end:
- **Winner**: Higher `pnlPercent`
- **Draw**: Difference < `EPSILON` (0.0001%)
- Displayed as "Ahead", "Behind", or "Tied" in navbar

## Related Documentation

- [Fee Structure](./FEES.md)
- [Prize Pool Calculation](./PRIZE_POOL.md)
