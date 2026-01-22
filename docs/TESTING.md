# Trading Fight Club - Comprehensive Testing Document

## Table of Contents
1. [Fight System Tests](#1-fight-system-tests)
2. [Trading System Tests](#2-trading-system-tests)
3. [Pre-Fight Position Tests (CRITICAL)](#3-pre-fight-position-tests-critical)
4. [Authentication & Wallet Tests](#4-authentication--wallet-tests)
5. [Real-Time Updates Tests](#5-real-time-updates-tests)
6. [Leaderboard & Prize Pool Tests](#6-leaderboard--prize-pool-tests)
7. [Edge Cases & Race Conditions](#7-edge-cases--race-conditions)
8. [Unit Test Specifications](#8-unit-test-specifications)
9. [Automation Scripts](#9-automation-scripts)
10. [Open Questions](#10-open-questions)

---

## 1. Fight System Tests

### 1.1 Fight Creation

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| F-001 | Create fight with valid stake | 1. Connect wallet 2. Auth 3. Click "Create Fight" 4. Enter valid stake (within balance) 5. Confirm | Fight created with status PENDING, creator as participantA | HIGH |
| F-002 | Create fight with stake > balance | 1. Auth 2. Create fight with stake exceeding USDC balance | Error: "Insufficient balance" | MEDIUM |
| F-003 | Create fight with stake below minimum | 1. Auth 2. Create fight with stake < $1 | Error: "Minimum stake is $1" | LOW |
| F-004 | Create fight without Pacifica connection | 1. Auth without Pacifica linked 2. Try to create fight | Error: "Please connect Pacifica account first" | MEDIUM |
| F-005 | Create multiple fights simultaneously | 1. Auth 2. Create fight 3. While PENDING, try creating another | Should prevent or allow based on business rules | MEDIUM |

### 1.2 Fight Joining

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| F-010 | Join pending fight | 1. Auth as User B 2. Find PENDING fight 3. Click Join | Fight status → READY, participantB set, countdown starts | HIGH |
| F-011 | Join own fight | 1. Auth 2. Create fight 3. Try to join own fight | Error: "Cannot join your own fight" | MEDIUM |
| F-012 | Join already started fight | 1. Auth 2. Try to join LIVE fight | Join button should not be visible/enabled | MEDIUM |
| F-013 | Join fight with insufficient balance | 1. Auth with low balance 2. Try to join fight with higher stake | Error about insufficient balance | MEDIUM |
| F-014 | Creator notification on join | 1. Create fight as User A 2. Join as User B | User A receives notification that opponent joined | MEDIUM |

### 1.3 Fight Lifecycle

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| F-020 | Fight countdown to start | 1. Create & join fight 2. Wait for countdown | After countdown (30s default), status → LIVE | HIGH |
| F-021 | Fight duration tracking | 1. Start fight 2. Monitor timer | Timer counts down from fight duration correctly | HIGH |
| F-022 | Fight end - clear winner | 1. Complete fight 2. One user has higher PnL% | Winner determined, fight status → COMPLETED | HIGH |
| F-023 | Fight end - draw (EPSILON) | 1. Complete fight 2. Both users within 0.0001% PnL | Draw declared, stakes returned | HIGH |
| F-024 | Fight cancellation (creator) | 1. Create fight 2. Cancel before anyone joins | Fight status → CANCELLED | MEDIUM |
| F-025 | Fight timeout (no opponent) | 1. Create fight 2. Wait past expiry time | Fight auto-cancelled | LOW |

### 1.4 Initial Position Snapshot

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| F-030 | Snapshot on fight create | 1. Have open positions 2. Create fight | `initialPositions` JSON saved for creator | CRITICAL |
| F-031 | Snapshot on fight join | 1. Have open positions 2. Join fight | `initialPositions` JSON saved for joiner | CRITICAL |
| F-032 | Snapshot with no positions | 1. Close all positions 2. Create/join fight | `initialPositions` = empty array `[]` | HIGH |
| F-033 | Snapshot accuracy | 1. Have 3 positions 2. Create fight 3. Verify snapshot | All position details match (symbol, size, side, entryPrice) | CRITICAL |

---

## 2. Trading System Tests

### 2.1 Market Orders

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| T-001 | Long market order | 1. Select symbol 2. Enter amount 3. Click Long | Position opened, order recorded in TfcOrderAction | HIGH |
| T-002 | Short market order | 1. Select symbol 2. Enter amount 3. Click Short | Position opened, order recorded | HIGH |
| T-003 | Market order during fight | 1. Be in LIVE fight 2. Place market order | Order has fightId, recorded in FightTrade if not closing pre-fight | CRITICAL |
| T-004 | Close position (market) | 1. Have open position 2. Click close | Position closed, PnL realized | HIGH |
| T-005 | Partial close | 1. Have position of 100 2. Close 50 | Position reduced to 50 | MEDIUM |

### 2.2 Limit Orders

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| T-010 | Place limit buy order | 1. Select symbol 2. Set price below market 3. Submit | Order placed, appears in Open Orders | HIGH |
| T-011 | Place limit sell order | 1. Select symbol 2. Set price above market 3. Submit | Order placed, appears in Open Orders | HIGH |
| T-012 | Limit order fill | 1. Place limit order 2. Wait for market to hit price | Order filled, position opened, moves to Order History | HIGH |
| T-013 | Cancel limit order | 1. Have open limit order 2. Click cancel | Order cancelled, removed from Open Orders | MEDIUM |
| T-014 | Limit order during fight | 1. In LIVE fight 2. Place limit order | Order has fightId in TfcOrderAction | HIGH |

### 2.3 Stake Limit Enforcement

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| T-020 | Order within stake limit | 1. In $100 stake fight 2. Place $50 order | Order succeeds | HIGH |
| T-021 | Order exceeds stake limit | 1. In $100 stake fight 2. Place $150 order | Order rejected: "Order exceeds fight stake limit" | CRITICAL |
| T-022 | Cumulative orders at limit | 1. In $100 fight 2. Place $60 order 3. Place $60 order | Second order rejected (total would exceed $100) | CRITICAL |
| T-023 | Reduce position at limit | 1. At stake limit 2. Close part of position 3. Open new | Should allow based on freed margin | HIGH |

---

## 3. Pre-Fight Position Tests (CRITICAL)

### 3.1 Pre-Fight Position Exclusion

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| PF-001 | Close pre-fight long during fight | 1. Have 100 BTC long 2. Create/join fight 3. Close the 100 BTC | Trade NOT recorded in FightTrade, PnL excluded from fight | CRITICAL |
| PF-002 | Close pre-fight short during fight | 1. Have 50 ETH short 2. Create/join fight 3. Close the 50 ETH | Trade NOT recorded in FightTrade | CRITICAL |
| PF-003 | Partial close of pre-fight | 1. Have 100 BTC long (pre-fight) 2. Start fight 3. Close 60 | 60 excluded from fight, position now 40 | CRITICAL |
| PF-004 | New position same symbol as pre-fight | 1. Have 100 BTC long (pre-fight) 2. Start fight 3. Open 50 BTC short | The 50 short IS a fight trade (new position) | CRITICAL |
| PF-005 | Close pre-fight then reopen | 1. Pre-fight: 100 BTC long 2. Start fight 3. Close 100 4. Open 100 BTC long | Close excluded, new open IS fight trade | CRITICAL |

### 3.2 Mixed Positions During Fight

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| PF-010 | Pre-fight + fight position same symbol | 1. Pre-fight: 100 BTC long 2. Start 3. Open 50 more BTC | Total: 150 BTC, but only 50 counts for fight PnL | CRITICAL |
| PF-011 | Multiple symbols mixed | 1. Pre-fight: BTC long, ETH short 2. Fight: SOL long | Only SOL counted for fight | HIGH |
| PF-012 | External trade detection | 1. In fight 2. Trade on Pacifica directly (not via TFC) | External trade detected (30s interval), handled appropriately | HIGH |

### 3.3 PnL Calculation Accuracy

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| PF-020 | Fight PnL excludes pre-fight | 1. Pre-fight: +$50 unrealized 2. Start fight 3. Market moves +$20 | Fight PnL = $20 (from fight trades only) | CRITICAL |
| PF-021 | Fight PnL with pre-fight close | 1. Pre-fight: +$50 unrealized 2. Start 3. Close pre-fight (+$50 realized) | Fight PnL = $0 (close excluded) | CRITICAL |
| PF-022 | Winner determined by fight PnL only | 1. User A: pre-fight +$100, fight -$10 2. User B: no pre-fight, fight +$5 | User B wins (fight PnL: +5% vs -10%) | CRITICAL |

---

## 4. Authentication & Wallet Tests

### 4.1 Wallet Connection

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| A-001 | Connect Phantom wallet | 1. Click Connect 2. Select Phantom 3. Approve | Wallet connected, sign prompt appears | HIGH |
| A-002 | Sign authentication message | 1. Connect wallet 2. Sign message | JWT token received, user authenticated | HIGH |
| A-003 | Reject signature | 1. Connect wallet 2. Reject sign prompt | Auth fails gracefully, can retry | MEDIUM |
| A-004 | Disconnect wallet | 1. Authenticated 2. Click disconnect | Auth cleared, wallet disconnected | MEDIUM |

### 4.2 Session Persistence

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| A-010 | Refresh with same wallet | 1. Auth 2. Refresh page | Should restore session (localStorage) | HIGH |
| A-011 | Switch wallet in extension | 1. Auth with Wallet A 2. Switch to Wallet B in Phantom | Detect change, clear auth, prompt new sign | HIGH |
| A-012 | Close browser, reopen | 1. Auth 2. Close browser 3. Reopen | Session restored if same wallet | MEDIUM |

### 4.3 Pacifica Integration

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| A-020 | Auto-link Pacifica on auth | 1. Have Pacifica account 2. Connect wallet & sign | Pacifica auto-linked if address matches | HIGH |
| A-021 | Pacifica not linked | 1. No Pacifica account 2. Auth | `pacificaConnected: false`, show link prompt | MEDIUM |
| A-022 | Pacifica connection status | 1. Auth 2. Check UI | Shows Pacifica status in profile/header | LOW |

---

## 5. Real-Time Updates Tests

### 5.1 WebSocket Connection

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| RT-001 | WS connect on fight start | 1. Join fight 2. Countdown ends | WebSocket connects to fight room | HIGH |
| RT-002 | WS reconnect on disconnect | 1. In fight 2. Network blip | Auto-reconnect, resume updates | HIGH |
| RT-003 | WS disconnect on fight end | 1. Fight ends | WebSocket cleanly disconnected | MEDIUM |

### 5.2 PnL Updates

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| RT-010 | PNL_TICK every second | 1. In LIVE fight 2. Monitor updates | Receive PnL update every ~1 second | HIGH |
| RT-011 | Leader indicator | 1. In fight 2. One user takes lead | Leader badge updates in real-time | MEDIUM |
| RT-012 | Score accuracy | 1. In fight 2. Compare WS score to calculated | Scores should match (minor delay OK) | HIGH |

### 5.3 Event Notifications

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| RT-020 | Fight start notification | 1. In READY fight 2. Countdown ends | Both users notified fight started | MEDIUM |
| RT-021 | Fight end notification | 1. In LIVE fight 2. Timer reaches 0 | Both users notified, winner shown | HIGH |
| RT-022 | Opponent trade notification | 1. In fight 2. Opponent trades | Notification/indicator of opponent activity | LOW |

---

## 6. Leaderboard & Prize Pool Tests

### 6.1 Leaderboard Display

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| L-001 | Top 10 display | 1. View leaderboard | Shows top 10 by total winnings | MEDIUM |
| L-002 | Podium positions | 1. View leaderboard | 1st, 2nd, 3rd shown with special styling | LOW |
| L-003 | User stats accuracy | 1. Complete fights 2. Check leaderboard | Wins, losses, total correctly calculated | HIGH |
| L-004 | Prize pool display | 1. View leaderboard | Shows total prize pool from all fights | MEDIUM |

### 6.2 Stats Calculation

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| L-010 | Win recorded | 1. Win fight 2. Check stats | Wins +1, winnings updated | HIGH |
| L-011 | Loss recorded | 1. Lose fight 2. Check stats | Losses +1 | HIGH |
| L-012 | Draw recorded | 1. Draw fight 2. Check stats | Neither win nor loss incremented | MEDIUM |

---

## 7. Edge Cases & Race Conditions

### 7.1 Concurrent Actions

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| E-001 | Two users join same fight | 1. Fight PENDING 2. User B & C click join simultaneously | Only one succeeds, other gets error | HIGH |
| E-002 | Order during fight end | 1. Place order as fight timer hits 0 | Order rejected or handled gracefully | HIGH |
| E-003 | Disconnect during fight | 1. In LIVE fight 2. Lose connection 3. Reconnect | Fight continues, can resume trading | HIGH |

### 7.2 Data Consistency

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| E-010 | Fight data matches DB | 1. Complete fight 2. Check UI vs DB | Winner, scores, timestamps match | HIGH |
| E-011 | Position sync with Pacifica | 1. Check TFC positions vs Pacifica | Positions should match (within refresh interval) | HIGH |
| E-012 | Trade history completeness | 1. Make trades 2. Check history | All trades appear in history | MEDIUM |

### 7.3 Error Recovery

| ID | Test Case | Steps | Expected Result | Risk |
|----|-----------|-------|-----------------|------|
| E-020 | API timeout during order | 1. Place order 2. Simulate slow response | Proper timeout handling, no duplicate orders | HIGH |
| E-021 | Invalid token mid-session | 1. Manually invalidate token 2. Try action | Redirect to re-auth | MEDIUM |
| E-022 | Pacifica API failure | 1. Pacifica down 2. Try to trade | Graceful error, no data corruption | HIGH |

---

## 8. Unit Test Specifications

### 8.1 PnL Calculation Tests (`lib/pnl.test.ts`)

```typescript
describe('PnL Calculations', () => {
  describe('calculatePositionPnl', () => {
    it('should calculate long position profit correctly', () => {
      // Entry: $100, Current: $110, Size: 10
      // Expected: ($110 - $100) * 10 = $100 profit
    });

    it('should calculate long position loss correctly', () => {
      // Entry: $100, Current: $90, Size: 10
      // Expected: ($90 - $100) * 10 = -$100 loss
    });

    it('should calculate short position profit correctly', () => {
      // Entry: $100, Current: $90, Size: 10
      // Expected: ($100 - $90) * 10 = $100 profit
    });

    it('should calculate short position loss correctly', () => {
      // Entry: $100, Current: $110, Size: 10
      // Expected: ($100 - $110) * 10 = -$100 loss
    });
  });

  describe('calculateFightPnl', () => {
    it('should exclude pre-fight positions from PnL', () => {
      const initialPositions = [{ symbol: 'BTC', size: 100, side: 'long', entryPrice: 50000 }];
      const currentPositions = [{ symbol: 'BTC', size: 100, side: 'long', entryPrice: 50000, currentPrice: 51000 }];
      // Pre-fight position, should return 0 fight PnL
    });

    it('should include only fight trades in PnL', () => {
      const initialPositions = [];
      const currentPositions = [{ symbol: 'BTC', size: 50, side: 'long', entryPrice: 50000, currentPrice: 51000 }];
      // New position during fight, should calculate PnL
    });

    it('should handle mixed pre-fight and fight positions', () => {
      const initialPositions = [{ symbol: 'BTC', size: 100, side: 'long' }];
      const currentPositions = [{ symbol: 'BTC', size: 150, side: 'long' }];
      // Only the additional 50 is fight position
    });
  });

  describe('determineWinner', () => {
    it('should return winner when PnL difference > EPSILON', () => {
      // User A: +5%, User B: +3%
      // Expected: User A wins
    });

    it('should return draw when PnL difference <= EPSILON', () => {
      // User A: +5.00005%, User B: +5.00000%
      // Expected: Draw (within 0.0001%)
    });
  });
});
```

### 8.2 Fight Logic Tests (`lib/fight.test.ts`)

```typescript
describe('Fight Logic', () => {
  describe('validateFightCreation', () => {
    it('should reject stake below minimum', () => {});
    it('should reject stake above balance', () => {});
    it('should require Pacifica connection', () => {});
  });

  describe('validateFightJoin', () => {
    it('should prevent joining own fight', () => {});
    it('should prevent joining non-PENDING fight', () => {});
    it('should check sufficient balance', () => {});
  });

  describe('calculateInitialPositions', () => {
    it('should snapshot all current positions', () => {});
    it('should return empty array when no positions', () => {});
    it('should include all position fields', () => {});
  });

  describe('validateStakeLimit', () => {
    it('should allow order within stake limit', () => {});
    it('should reject order exceeding stake limit', () => {});
    it('should account for existing positions', () => {});
  });
});
```

### 8.3 Trade Recording Tests (`lib/trade.test.ts`)

```typescript
describe('Trade Recording', () => {
  describe('recordFightTradeWithDetails', () => {
    it('should record new position as fight trade', () => {});
    it('should NOT record pre-fight position close', () => {});
    it('should handle partial pre-fight close', () => {});
    it('should record opposite side as new trade', () => {});
  });

  describe('isPreFightPosition', () => {
    it('should identify exact match pre-fight position', () => {});
    it('should identify partial pre-fight position', () => {});
    it('should return false for new position', () => {});
  });
});
```

### 8.4 Auth Store Tests (`lib/store.test.ts`)

```typescript
describe('Auth Store', () => {
  describe('setAuth', () => {
    it('should set all auth fields', () => {});
    it('should set isAuthenticated to true', () => {});
  });

  describe('clearAuth', () => {
    it('should clear all auth fields', () => {});
    it('should set isAuthenticated to false', () => {});
  });

  describe('persistence', () => {
    it('should persist to localStorage', () => {});
    it('should hydrate from localStorage', () => {});
    it('should set _hasHydrated after hydration', () => {});
  });
});
```

---

## 9. Automation Scripts

### 9.1 Database Verification Script

```bash
#!/bin/bash
# scripts/verify-db-integrity.sh

echo "=== Fight Data Integrity Check ==="

# Check for fights with missing participants
echo "Checking fights with missing participants..."
psql $DATABASE_URL -c "
  SELECT f.id, f.status
  FROM \"Fight\" f
  WHERE f.status = 'LIVE'
  AND (f.\"creatorId\" IS NULL OR NOT EXISTS (
    SELECT 1 FROM \"FightParticipant\" fp WHERE fp.\"fightId\" = f.id
  ))
"

# Check for orphaned fight trades
echo "Checking orphaned fight trades..."
psql $DATABASE_URL -c "
  SELECT ft.id
  FROM \"FightTrade\" ft
  LEFT JOIN \"Fight\" f ON ft.\"fightId\" = f.id
  WHERE f.id IS NULL
"

# Check for completed fights without winner
echo "Checking completed fights without winner..."
psql $DATABASE_URL -c "
  SELECT id FROM \"Fight\"
  WHERE status = 'COMPLETED'
  AND \"winnerId\" IS NULL
  AND \"isDraw\" = false
"

echo "=== Check Complete ==="
```

### 9.2 API Health Check Script

```typescript
// scripts/api-health-check.ts
import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface HealthCheck {
  name: string;
  endpoint: string;
  method: string;
  expectedStatus: number;
}

const checks: HealthCheck[] = [
  { name: 'API Root', endpoint: '/api/health', method: 'GET', expectedStatus: 200 },
  { name: 'Fights List', endpoint: '/api/fights', method: 'GET', expectedStatus: 200 },
  { name: 'Leaderboard', endpoint: '/api/leaderboard', method: 'GET', expectedStatus: 200 },
  { name: 'Prices', endpoint: '/api/prices', method: 'GET', expectedStatus: 200 },
];

async function runHealthChecks() {
  console.log('=== API Health Check ===\n');

  for (const check of checks) {
    try {
      const res = await fetch(`${BASE_URL}${check.endpoint}`, { method: check.method });
      const status = res.status === check.expectedStatus ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${res.status}`);
    } catch (error) {
      console.log(`❌ ${check.name}: FAILED - ${error.message}`);
    }
  }
}

runHealthChecks();
```

### 9.3 Fight Flow E2E Test

```typescript
// scripts/e2e-fight-flow.ts
// Requires: playwright or puppeteer

import { test, expect } from '@playwright/test';

test.describe('Fight Flow E2E', () => {
  test('complete fight flow', async ({ browser }) => {
    // Create two browser contexts for two users
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // User A: Connect wallet and create fight
    await pageA.goto('/lobby');
    await pageA.click('[data-testid="connect-wallet"]');
    // ... wallet connection mock
    await pageA.click('[data-testid="create-fight"]');
    await pageA.fill('[data-testid="stake-input"]', '10');
    await pageA.click('[data-testid="confirm-create"]');

    // Get fight ID
    const fightId = await pageA.getAttribute('[data-testid="pending-fight"]', 'data-fight-id');

    // User B: Join the fight
    await pageB.goto('/lobby');
    await pageB.click('[data-testid="connect-wallet"]');
    // ... wallet connection mock
    await pageB.click(`[data-testid="join-fight-${fightId}"]`);

    // Wait for countdown
    await pageA.waitForSelector('[data-testid="fight-status-live"]', { timeout: 60000 });

    // User A: Place a trade
    await pageA.goto('/trade');
    await pageA.fill('[data-testid="amount-input"]', '5');
    await pageA.click('[data-testid="long-button"]');

    // Wait for fight to end (or skip for testing)
    // ...

    // Verify winner determined
    await pageA.waitForSelector('[data-testid="fight-result"]');
    const result = await pageA.textContent('[data-testid="fight-result"]');
    expect(result).toMatch(/Winner|Draw/);
  });
});
```

### 9.4 Pre-Fight Position Verification

```typescript
// scripts/verify-prefight-positions.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPreFightPositions() {
  console.log('=== Pre-Fight Position Verification ===\n');

  // Get all LIVE fights
  const liveFights = await prisma.fight.findMany({
    where: { status: 'LIVE' },
    include: {
      participants: true,
      trades: true,
    },
  });

  for (const fight of liveFights) {
    console.log(`\nFight: ${fight.id}`);

    for (const participant of fight.participants) {
      const initialPositions = participant.initialPositions as any[];
      console.log(`  Participant: ${participant.userId}`);
      console.log(`    Initial Positions: ${initialPositions?.length || 0}`);

      // Get fight trades for this participant
      const fightTrades = fight.trades.filter(t => t.userId === participant.userId);
      console.log(`    Fight Trades: ${fightTrades.length}`);

      // Verify no fight trade closes a pre-fight position
      for (const trade of fightTrades) {
        const matchesPreFight = initialPositions?.some(
          ip => ip.symbol === trade.symbol && ip.side !== trade.side
        );
        if (matchesPreFight) {
          console.log(`    ⚠️ WARNING: Trade ${trade.id} may be closing pre-fight position`);
        }
      }
    }
  }
}

verifyPreFightPositions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 10. Open Questions

### Technical Clarifications Needed

1. **Pre-fight position netting**: If user has 100 BTC long pre-fight and opens 50 BTC short during fight, is this:
   - a) A 50 BTC short position (netted)?
   - b) Two separate positions (100 long + 50 short)?
   - How does Pacifica handle position netting?

2. **Stake limit enforcement timing**: Is stake limit checked:
   - a) At order placement time?
   - b) At order fill time?
   - c) Both?

3. **External trade handling**: When external trade detected (not via TFC):
   - a) Is it counted in fight PnL?
   - b) Is it recorded in FightTrade?
   - c) Does it affect stake limit?

4. **Fight cancellation scenarios**:
   - Can creator cancel after opponent joins but before start?
   - What happens to positions if fight cancelled mid-way?

5. **WebSocket failure during fight**:
   - How long before reconnect gives up?
   - Is there a fallback polling mechanism?
   - What happens to PnL updates during disconnect?

6. **Draw payout mechanics**:
   - Are stakes returned 1:1?
   - Any platform fee on draws?

### Business Logic Clarifications

7. **Multiple concurrent fights**: Can a user be in multiple fights simultaneously?

8. **Fight duration options**: What are the available fight durations? (1 min, 5 min, etc.)

9. **Minimum/Maximum stake limits**: What are the actual limits? ($1 min mentioned in code)

10. **Leaderboard reset frequency**: Daily? Weekly? All-time?

---

## Test Execution Checklist

### Before Each Test Session
- [ ] Fresh database state or known seed data
- [ ] Both test wallets have sufficient USDC
- [ ] Pacifica connection verified for test accounts
- [ ] WebSocket server running
- [ ] Price feeds active

### Critical Path Tests (Run Every Deploy)
- [ ] F-001: Create fight
- [ ] F-010: Join fight
- [ ] F-020: Fight countdown
- [ ] F-022: Fight end with winner
- [ ] PF-001: Pre-fight position exclusion
- [ ] T-001/T-002: Market orders work
- [ ] T-021: Stake limit enforced

### Full Regression (Weekly)
- [ ] All Fight System tests
- [ ] All Trading System tests
- [ ] All Pre-Fight Position tests
- [ ] All Auth tests
- [ ] Edge cases E-001 to E-003

---

## Appendix: Test Data Setup

### Seed Data Script

```sql
-- Create test users
INSERT INTO "User" (id, handle, "walletAddress", "pacificaAccountAddress", "avatarUrl", "createdAt", "updatedAt")
VALUES
  ('test-user-a', 'TestUserA', 'WalletAddressA...', 'PacificaA...', null, NOW(), NOW()),
  ('test-user-b', 'TestUserB', 'WalletAddressB...', 'PacificaB...', null, NOW(), NOW());

-- Create test fight (PENDING)
INSERT INTO "Fight" (id, "creatorId", stake, duration, status, "createdAt", "updatedAt")
VALUES ('test-fight-1', 'test-user-a', 100.00, 300, 'PENDING', NOW(), NOW());

-- Add creator as participant
INSERT INTO "FightParticipant" ("fightId", "userId", "initialPositions", "createdAt")
VALUES ('test-fight-1', 'test-user-a', '[]', NOW());
```

### Environment Variables for Testing

```env
# .env.test
DATABASE_URL="postgresql://test:test@localhost:5432/tfc_test"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NEXT_PUBLIC_WS_URL="ws://localhost:3001"
PACIFICA_API_URL="https://testnet.pacifica.xyz"
```
