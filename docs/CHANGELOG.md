# Changelog

All notable changes to TradeFightClub are documented here.

---

## [2026-01-21] - Fight Engine Rules Implementation

### Summary

Full implementation of Fight-Engine_Rules.md, ensuring the fight PnL calculation only counts **CLOSED positions** (not open positions). Added 30-second warning before fight ends.

### Added

#### Backend (`apps/realtime`)

- **`fight-pnl-calculator.ts`**: Extracted PnL calculation logic for testability
  - `calculateFightPnl()`: Calculates realized PnL from only CLOSING trades
  - `calculatePnlPercent()`: Calculates ROI% with maxExposureUsed fallback

- **`fight-pnl-calculator.test.ts`**: 16 unit tests covering:
  - Opening trades don't count for PnL
  - Closing trades do count
  - Partial closes count proportionally
  - Position flips (close + open)
  - maxExposureUsed fallback when margin = 0
  - Real bug scenarios from production

- **30-second warning** (Rules 30-32):
  - `FIGHT_ENDING_SOON` WebSocket event
  - Emitted once at 30 seconds before fight ends
  - Warns users to close positions

#### Frontend (`apps/web`)

- **`useSocket.ts`**: Added listener for `FIGHT_ENDING_SOON` event
  - Shows notification: "30 seconds remaining! Close all positions now!"

#### Shared (`packages/shared`)

- **`ws-events.ts`**: Added `FIGHT_ENDING_SOON` event and `FightEndingSoonPayload` interface
- **`constants/index.ts`**: Added 1-minute fight duration for testing

### Changed

#### Backend (`apps/realtime`)

- **`fight-engine.ts`**:
  - `calculateUnrealizedPnlFromFightTrades()`: Now returns `realizedPnl` separately
  - Only CLOSING trades contribute to `realizedPnl` (Rules 18-21)
  - Opening trades (BUY for LONG, SELL for SHORT) excluded from PnL
  - Uses `maxExposureUsed` as fallback for ROI% when positions are closed

#### API (`apps/web/src/app/api`)

- **`fights/[id]/trades/route.ts`**: Fixed "Unknown" trader and "Invalid Date" issues
  - Added `participantUserId` from FightTrade records
  - Converted `created_at` (timestamp) to `executedAt` (ISO string)
  - Added `id` field for React keys
  - Normalized `side` from Pacifica format to BUY/SELL
  - Fetches trades from BOTH participants for completed fights

### Documentation

- **`FIGHT_PNL_CALCULATION.md`**: Complete rewrite documenting new logic
- **`Fight-Engine_Rules.md`**: Added implementation status and file references

### Fixed

- Fight navbar showing PnL from open positions (should be 0%)
- Fight results page showing "Unknown" trader
- Fight results page showing "Invalid Date"
- Opening fee being counted as loss

### Tests

Run tests with:
```bash
cd apps/realtime
npm test
```

Output:
```
Running Fight PnL Calculator tests...

Testing compliance with Fight-Engine_Rules.md Rules 18-25

  ✓ Rule 18-21: Opening LONG position - pnl should be 0
  ✓ Rule 18-21: Opening SHORT position - pnl should be 0
  ✓ Rule 18-21: Close LONG position - pnl SHOULD count
  ✓ Rule 18-21: Close SHORT position - pnl SHOULD count
  ✓ Rule 18-21: Partial close - only closing portion counts
  ✓ Rule 18-21: Close and flip position - only closing portion counts
  ✓ Fight ends with open position - pnl should be 0
  ✓ Multiple trades, partial closes, some open - complex scenario
  ✓ PnL percent with open position uses current margin
  ✓ PnL percent after closing position uses maxExposureUsed
  ✓ PnL percent is 0 when no margin and no exposure
  ✓ Negative PnL percent shows loss correctly
  ✓ Bug: User opens SHORT, fight ends without close - should be 0%
  ✓ Bug: User opens and closes SHORT - pnl SHOULD count
  ✓ No trades - pnl is 0
  ✓ Winner with 0 trades beats loser with negative pnl

16 passed, 0 failed
```

### Files Modified

| File | Change |
|------|--------|
| `apps/realtime/src/fight-engine.ts` | PnL calculation logic |
| `apps/realtime/src/fight-pnl-calculator.ts` | NEW: Testable PnL calculator |
| `apps/realtime/src/fight-pnl-calculator.test.ts` | NEW: 16 unit tests |
| `apps/realtime/package.json` | Added `test` script |
| `apps/web/src/hooks/useSocket.ts` | Added FIGHT_ENDING_SOON listener |
| `apps/web/src/app/api/fights/[id]/trades/route.ts` | Fixed trade display issues |
| `packages/shared/src/events/ws-events.ts` | Added FIGHT_ENDING_SOON event |
| `packages/shared/src/constants/index.ts` | Added 1-minute duration |
| `docs/FIGHT_PNL_CALCULATION.md` | Complete documentation rewrite |
| `docs/Fight-Engine_Rules.md` | Added implementation status |
| `docs/CHANGELOG.md` | NEW: This file |

---

## Previous Changes

_No previous changelog entries. This is the first documented release._
