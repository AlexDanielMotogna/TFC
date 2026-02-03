# Fight Engine MVP - Simplified Rules

> **Status**: PROPOSAL - Pending approval
> **Goal**: Simplify fight logic for MVP launch while maintaining competitive integrity

---

## Current State Analysis

### What Works Well
- PnL calculation logic (realized only)
- Anti-cheat system (5 rules)
- WebSocket real-time updates
- FightTrade recording

### Current Complexity Issues

| Issue | Impact | Complexity Level |
|-------|--------|------------------|
| Multiple active fights per user | High DB queries, complex state management | 🔴 High |
| RULE 35 - Fight-relevant trade filtering | Pacifica API call per trade, complex math | 🔴 High |
| Pre-fight position handling | Confusing UX, complex edge cases | 🟡 Medium |
| External trades detection | Continuous polling, false positives | 🟡 Medium |
| Stake limit recalculation | Full FightTrade scan per order | 🟡 Medium |

---

## MVP Simplification Proposal

### 1. ONE ACTIVE FIGHT PER USER

**Current**: User can be in multiple LIVE fights simultaneously.

**MVP**: User can only be in ONE LIVE fight at a time.

**Benefits**:
- Simpler state management
- No confusion about which fight a trade belongs to
- Cleaner UI (no fight selector needed)
- Reduced DB queries

**Implementation**:
```typescript
// Before allowing user to create/join fight:
const activeFight = await prisma.fightParticipant.findFirst({
  where: {
    userId,
    fight: { status: 'LIVE' }
  }
});

if (activeFight) {
  throw new Error('You are already in an active fight. Finish it first.');
}
```

**UI Changes**:
- "Challenge Trader" button disabled if user has active fight
- "Join Fight" button disabled if user has active fight
- Show clear message: "Finish your current fight to start a new one"

---

### 2. PRE-FIGHT POSITIONS: ALLOWED TO TRADE, BUT DON'T COUNT

**Problem**: User has BTC position from before fight. Currently confusing:
- Can they trade it? (Yes, but complex RULE 35 logic)
- Does it count for PnL? (Partially, only fight-relevant portion)
- UI shows mixed positions (confusing)

**MVP Solution**:

#### 2.1 Pre-Fight Positions Are "Frozen" for Fight Scoring

| Scenario | What Happens | Fight PnL Impact |
|----------|--------------|------------------|
| User has 1 BTC pre-fight, does nothing | Position unchanged | 0% (ignored) |
| User has 1 BTC pre-fight, sells 1 BTC | Closes pre-fight position | 0% (ignored) |
| User has 1 BTC pre-fight, buys 0.5 BTC, sells 0.5 BTC | Opens+closes 0.5 BTC | PnL from 0.5 BTC only |
| User has 1 BTC pre-fight, sells 1.5 BTC | Closes 1 pre-fight + opens 0.5 SHORT | PnL from 0.5 SHORT only |

#### 2.2 Simplified Trade Recording

**At fight join**: Snapshot all current positions as `initialPositions` on FightParticipant.

**On each trade**:
```typescript
// Calculate fight-relevant amount (simplified)
const preFightAmount = initialPositions[symbol]?.amount ?? 0;
const currentTfcNet = sumFightTrades(fightId, userId, symbol); // bought - sold

// For SELL order:
if (side === 'SELL') {
  // Only the portion that closes TFC-opened positions counts
  const tfcLongToClose = Math.max(0, currentTfcNet);
  const fightRelevantAmount = Math.min(amount, tfcLongToClose);

  // If opening new SHORT, that counts too
  const newShortAmount = Math.max(0, -currentTfcNet - preFightAmount + amount);
  fightRelevantAmount += newShortAmount;
}

// For BUY order:
if (side === 'BUY') {
  // Only the portion that closes TFC-opened shorts counts
  const tfcShortToClose = Math.max(0, -currentTfcNet);
  const fightRelevantAmount = Math.min(amount, tfcShortToClose);

  // If opening new LONG beyond pre-fight, that counts
  const newLongAmount = Math.max(0, currentTfcNet + preFightAmount + amount - preFightAmount);
  fightRelevantAmount += newLongAmount;
}

// Record only fight-relevant portion to FightTrade
if (fightRelevantAmount > 0) {
  const ratio = fightRelevantAmount / amount;
  await prisma.fightTrade.create({
    data: {
      fightId,
      participantUserId: userId,
      symbol,
      side,
      amount: fightRelevantAmount,
      price,
      fee: trade.fee * ratio,
      pnl: trade.pnl * ratio,
      // ... other fields
    }
  });
}
```

#### 2.3 UI: Separate Fight vs Non-Fight Positions

**Fight-Only View** (during active fight):
- Show ONLY positions opened during fight
- Show fight capital used vs stake limit
- "Close" button only closes fight positions

**All Positions View** (toggle or separate tab):
- Show all positions including pre-fight
- Can close any position (but pre-fight closes don't affect fight PnL)

---

### 3. NAVBAR PnL: ONLY SHOW REALIZED (CLOSED) PnL

**Current**: Shows unrealized PnL which is confusing (open positions don't count for fight).

**MVP**: Only show PnL from CLOSED positions.

**Implementation**:
```typescript
// In FightBanner.tsx
// Don't show unrealized PnL, only realized
const displayPnl = fightState.participantA.realizedPnlPercent; // NOT totalPnlPercent

// Show message when user has open positions
{hasOpenPositions && (
  <div className="text-xs text-amber-400">
    Open positions don't count. Close to lock in PnL!
  </div>
)}
```

**Visual Design**:
```
┌─────────────────────────────────────────┐
│ ⚔ FIGHT ACTIVE  │ 04:32 remaining       │
├─────────────────────────────────────────┤
│ You: +2.45%     │ Opp: -1.23%           │
│ (Realized only) │                        │
│ ⚠ 1 open position - close to score!    │
└─────────────────────────────────────────┘
```

---

### 4. STAKE LIMIT: SIMPLIFIED CALCULATION

**Current**: Complex calculation scanning all FightTrades.

**MVP**: Cache on FightParticipant record.

```prisma
model FightParticipant {
  // ... existing fields ...

  // Cached values (updated on each trade)
  currentExposure   Decimal @default(0)  // Current open position value
  maxExposureUsed   Decimal @default(0)  // Max ever used (for ROI%)
  availableCapital  Decimal              // stake - maxExposureUsed + currentExposure
}
```

**On trade execution**:
```typescript
await prisma.fightParticipant.update({
  where: { id: participantId },
  data: {
    currentExposure: newExposure,
    maxExposureUsed: Math.max(existing.maxExposureUsed, newExposure),
    availableCapital: stake - Math.max(existing.maxExposureUsed, newExposure) + newExposure
  }
});
```

**On order validation**:
```typescript
// Simple lookup, no aggregation needed
const participant = await prisma.fightParticipant.findFirst({
  where: { fight: { status: 'LIVE' }, userId }
});

if (orderNotional > participant.availableCapital) {
  throw new Error('Exceeds fight capital limit');
}
```

---

### 5. EXTERNAL TRADES DETECTION: END-OF-FIGHT ONLY

**Current**: Polls every 30 seconds during fight.

**MVP**: Check only when fight ends.

**Benefits**:
- Reduces Pacifica API calls by 95%
- Simpler tick loop
- No false positive interruptions during fight

**Implementation**:
```typescript
// Remove from tick loop
// Only call in endFight():
async function endFight(fightId: string) {
  // ... existing logic ...

  // Check for external trades at the end
  await checkExternalTrades(fightId);

  // Continue with settlement
}
```

---

## New Simplified Rules

### Core Rules (Unchanged)

| Rule | Description |
|------|-------------|
| 1 | Fight engine is an isolated logical system |
| 2 | Only trades made via TFC app count |
| 3 | Database is the source of truth |
| 4 | Trades must be opened AND closed within fight time |

### MVP Rules (New/Modified)

| Rule | Description |
|------|-------------|
| **MVP-1** | User can only be in ONE active fight at a time |
| **MVP-2** | Pre-fight positions are frozen for fight scoring |
| **MVP-3** | Only fight-opened positions count towards PnL |
| **MVP-4** | Closing pre-fight positions has ZERO impact on fight PnL |
| **MVP-5** | Navbar shows ONLY realized PnL (closed positions) |
| **MVP-6** | Open positions show warning: "Close to score!" |
| **MVP-7** | Fight-Only view shows only fight positions |
| **MVP-8** | Stake limit is cached on FightParticipant |
| **MVP-9** | External trade detection runs only at fight end |

### PnL Rules (Unchanged but Clarified)

| Rule | Description |
|------|-------------|
| PnL-1 | PnL = sum of CLOSED position profits/losses |
| PnL-2 | Open positions = 0% contribution |
| PnL-3 | ROI% = realizedPnL / maxExposureUsed * 100 |
| PnL-4 | All fees included (Pacifica + TFC 0.05%) |
| PnL-5 | 30-second warning before fight ends |

### Anti-Cheat Rules (Unchanged)

| Rule | Trigger | Action |
|------|---------|--------|
| ZERO_ZERO | Both 0% PnL | NO_CONTEST |
| MIN_VOLUME | Volume < $10 | NO_CONTEST |
| REPEATED_MATCHUP | Same pair 3x/24h | NO_CONTEST |
| SAME_IP_PATTERN | Shared IP + pattern | NO_CONTEST |
| EXTERNAL_TRADES | Trades outside TFC | FLAGGED |

---

## Implementation Priority

### Phase 1: Critical Changes (Before MVP)

| Task | Files | Effort |
|------|-------|--------|
| One fight per user limit | fight creation/join endpoints | 1 day |
| Cache stake limit on FightParticipant | schema + trade recording | 1 day |
| Navbar: show realized only | FightBanner.tsx | 0.5 day |
| Move external check to end-of-fight | fight-engine.ts | 0.5 day |

### Phase 2: UX Improvements (MVP Launch)

| Task | Files | Effort |
|------|-------|--------|
| Fight-Only position view | Positions.tsx | 1 day |
| Open position warning banner | FightBanner.tsx | 0.5 day |
| Disable challenge button if in fight | LobbyPage.tsx | 0.5 day |

### Phase 3: Simplify Trade Recording (Post-MVP)

| Task | Files | Effort |
|------|-------|--------|
| Simplify RULE 35 logic | trade-recording.ts | 2 days |
| Remove Pacifica position API call | trade-recording.ts | 1 day |
| Incremental PnL updates | fight-pnl-calculator.ts | 2 days |

---

## Migration Notes

### Database Changes

```prisma
model FightParticipant {
  // Add new cached fields
  currentExposure   Decimal @default(0) @map("current_exposure")
  availableCapital  Decimal @default(0) @map("available_capital")
}

// Migration will set initial values from existing data
```

### Backward Compatibility

- Existing FINISHED fights: No changes needed
- Existing LIVE fights at migration: Will be grandfathered with old logic
- New fights after migration: Use MVP rules

---

## Summary: Before vs After

| Aspect | Before (Complex) | After (MVP) |
|--------|------------------|-------------|
| Fights per user | Multiple | ONE |
| Pre-fight positions | Complex RULE 35 | Frozen, ignored |
| Navbar PnL | Realized + Unrealized | Realized only |
| Stake calculation | Scan all FightTrades | Cached value |
| External trade check | Every 30 seconds | End of fight only |
| Position view | All mixed | Fight-only + All tabs |

**Total complexity reduction**: ~40% less code, ~60% fewer DB queries, ~95% fewer Pacifica API calls during fight.
