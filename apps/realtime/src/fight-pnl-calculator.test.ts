/**
 * Fight PnL Calculator Tests
 *
 * Tests the PnL calculation logic according to Fight-Engine_Rules.md
 *
 * Run with: npx ts-node src/fight-pnl-calculator.test.ts
 */

import { calculateFightPnl, calculatePnlPercent, type FightTrade } from './fight-pnl-calculator.js';

// Simple test runner
const tests: { name: string; fn: () => void }[] = [];
const test = (name: string, fn: () => void) => tests.push({ name, fn });
const expect = (actual: unknown) => ({
  toBe: (expected: unknown) => {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}`);
    }
  },
  toBeCloseTo: (expected: number, precision = 4) => {
    const diff = Math.abs((actual as number) - expected);
    if (diff > Math.pow(10, -precision)) {
      throw new Error(`Expected ${expected} (±${Math.pow(10, -precision)}), got ${actual}`);
    }
  },
});

// ─────────────────────────────────────────────────────────────
// Test: Rules 18-21 - Only CLOSING trades count for PnL
// ─────────────────────────────────────────────────────────────

test('Rule 18-21: Opening LONG position - pnl should be 0', () => {
  // Opening a LONG position: pnl from Pacifica = -fee (negative)
  // But per rules, opening trades don't count for fight PnL
  const trades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'BUY', amount: 0.001, price: 50000, pnl: -0.05, fee: 0.05 },
  ];

  const result = calculateFightPnl(trades);

  expect(result.realizedPnl).toBe(0); // Opening trade - doesn't count
  expect(result.totalFees).toBeCloseTo(0.05);
  expect(result.positionsBySymbol['BTC-USD']!.amount).toBeCloseTo(0.001); // Position is open
});

test('Rule 18-21: Opening SHORT position - pnl should be 0', () => {
  const trades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'SELL', amount: 0.001, price: 50000, pnl: -0.05, fee: 0.05 },
  ];

  const result = calculateFightPnl(trades);

  expect(result.realizedPnl).toBe(0); // Opening trade - doesn't count
  expect(result.positionsBySymbol['BTC-USD']!.amount).toBeCloseTo(-0.001); // SHORT position
});

test('Rule 18-21: Close LONG position - pnl SHOULD count', () => {
  // 1. Open LONG at 50000 (pnl = -fee)
  // 2. Close LONG at 51000 (pnl = profit - fee)
  const trades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'BUY', amount: 0.001, price: 50000, pnl: -0.05, fee: 0.05 },
    { symbol: 'BTC-USD', side: 'SELL', amount: 0.001, price: 51000, pnl: 0.95, fee: 0.05 }, // +1 USD profit - 0.05 fee = 0.95
  ];

  const result = calculateFightPnl(trades);

  // Only the closing trade's pnl counts
  expect(result.realizedPnl).toBeCloseTo(0.95);
  expect(result.totalFees).toBeCloseTo(0.10);
  expect(Math.abs(result.positionsBySymbol['BTC-USD']!.amount)).toBeCloseTo(0); // Position closed
});

test('Rule 18-21: Close SHORT position - pnl SHOULD count', () => {
  // 1. Open SHORT at 50000 (pnl = -fee)
  // 2. Close SHORT at 49000 (pnl = profit - fee)
  const trades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'SELL', amount: 0.001, price: 50000, pnl: -0.05, fee: 0.05 },
    { symbol: 'BTC-USD', side: 'BUY', amount: 0.001, price: 49000, pnl: 0.95, fee: 0.05 }, // +1 USD profit - 0.05 fee
  ];

  const result = calculateFightPnl(trades);

  expect(result.realizedPnl).toBeCloseTo(0.95);
  expect(Math.abs(result.positionsBySymbol['BTC-USD']!.amount)).toBeCloseTo(0); // Position closed
});

test('Rule 18-21: Partial close - only closing portion counts', () => {
  // 1. Open LONG 0.002 at 50000
  // 2. Close half (0.001) at 51000 - only this pnl counts
  const trades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'BUY', amount: 0.002, price: 50000, pnl: -0.10, fee: 0.10 },
    { symbol: 'BTC-USD', side: 'SELL', amount: 0.001, price: 51000, pnl: 0.95, fee: 0.05 },
  ];

  const result = calculateFightPnl(trades);

  expect(result.realizedPnl).toBeCloseTo(0.95); // Partial close pnl
  expect(result.positionsBySymbol['BTC-USD']!.amount).toBeCloseTo(0.001); // Half still open
});

test('Rule 18-21: Close and flip position - only closing portion counts', () => {
  // 1. Open LONG 0.001 at 50000
  // 2. SELL 0.002 at 51000 - closes 0.001 LONG, opens 0.001 SHORT
  // Only the 0.001 closing portion's pnl should count
  const trades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'BUY', amount: 0.001, price: 50000, pnl: -0.05, fee: 0.05 },
    { symbol: 'BTC-USD', side: 'SELL', amount: 0.002, price: 51000, pnl: 0.45, fee: 0.10 }, // Total trade pnl
  ];

  const result = calculateFightPnl(trades);

  // pnl is for 0.002 amount, but only 0.001 closes LONG
  // So realizedPnl = 0.45 * (0.001 / 0.002) = 0.225
  expect(result.realizedPnl).toBeCloseTo(0.225);
  expect(result.positionsBySymbol['BTC-USD']!.amount).toBeCloseTo(-0.001); // Now SHORT
});

// ─────────────────────────────────────────────────────────────
// Test: Fight ending scenarios
// ─────────────────────────────────────────────────────────────

test('Fight ends with open position - pnl should be 0', () => {
  // User opens position but never closes before fight ends
  const trades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'BUY', amount: 0.001, price: 50000, pnl: -0.05, fee: 0.05 },
  ];

  const result = calculateFightPnl(trades);

  expect(result.realizedPnl).toBe(0);
  expect(result.positionsBySymbol['BTC-USD']!.amount).toBeCloseTo(0.001); // Still open
});

test('Multiple trades, partial closes, some open - complex scenario', () => {
  // Scenario:
  // 1. Open LONG 0.002 BTC at 50000
  // 2. Close 0.001 at 51000 (profit)
  // 3. Open SHORT 0.001 ETH at 3000
  // 4. Close SHORT at 2900 (profit)
  // Final: 0.001 BTC still open (pnl doesn't count)

  const trades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'BUY', amount: 0.002, price: 50000, pnl: -0.10, fee: 0.10 },
    { symbol: 'BTC-USD', side: 'SELL', amount: 0.001, price: 51000, pnl: 0.95, fee: 0.05 },
    { symbol: 'ETH-USD', side: 'SELL', amount: 0.01, price: 3000, pnl: -0.03, fee: 0.03 },
    { symbol: 'ETH-USD', side: 'BUY', amount: 0.01, price: 2900, pnl: 0.97, fee: 0.03 },
  ];

  const result = calculateFightPnl(trades);

  // BTC close: 0.95, ETH close: 0.97
  expect(result.realizedPnl).toBeCloseTo(0.95 + 0.97);
  expect(result.positionsBySymbol['BTC-USD']!.amount).toBeCloseTo(0.001); // Still open
  expect(Math.abs(result.positionsBySymbol['ETH-USD']!.amount)).toBeCloseTo(0); // Closed
});

// ─────────────────────────────────────────────────────────────
// Test: PnL Percent calculation
// ─────────────────────────────────────────────────────────────

test('PnL percent with open position uses current margin', () => {
  const pnlPercent = calculatePnlPercent(
    10,    // $10 profit
    100,   // $100 current margin
    200    // $200 max exposure
  );

  expect(pnlPercent).toBeCloseTo(10); // 10 / 100 * 100 = 10%
});

test('PnL percent after closing position uses maxExposureUsed', () => {
  // User closed all positions, margin = 0, but made profit
  const pnlPercent = calculatePnlPercent(
    10,    // $10 profit
    0,     // $0 current margin (all closed)
    100    // $100 max exposure used
  );

  expect(pnlPercent).toBeCloseTo(10); // 10 / 100 * 100 = 10%
});

test('PnL percent is 0 when no margin and no exposure', () => {
  const pnlPercent = calculatePnlPercent(0, 0, 0);
  expect(pnlPercent).toBe(0);
});

test('Negative PnL percent shows loss correctly', () => {
  const pnlPercent = calculatePnlPercent(
    -5,    // $5 loss
    0,     // Closed
    100    // Had $100 exposure
  );

  expect(pnlPercent).toBeCloseTo(-5); // -5%
});

// ─────────────────────────────────────────────────────────────
// Test: Real-world bug scenario from user
// ─────────────────────────────────────────────────────────────

test('Bug: User opens SHORT, fight ends without close - should be 0%', () => {
  // This is the exact scenario from the screenshot:
  // - User FQUc...Fd1k opened SHORT BTC (SELL)
  // - Fight ended without closing
  // - Per rules, PnL should be 0, not the fee

  const trades: FightTrade[] = [
    {
      symbol: 'BTC-USD',
      side: 'SELL',
      amount: 0.0009,
      price: 87426,
      pnl: -0.0708,  // This is just the opening fee!
      fee: 0.0708,
    },
  ];

  const result = calculateFightPnl(trades);

  // Per Rules 18-21: Opening trade pnl does NOT count
  expect(result.realizedPnl).toBe(0);
  expect(result.totalFees).toBeCloseTo(0.0708);
  expect(result.positionsBySymbol['BTC-USD']!.amount).toBeCloseTo(-0.0009); // Still open

  // PnL percent should also be 0 (not -4.48%)
  const pnlPercent = calculatePnlPercent(
    result.realizedPnl,  // 0
    0,                   // Assume closed for test
    1.58                 // Max exposure ~$78.68 / 50x leverage
  );
  expect(pnlPercent).toBe(0);
});

test('Bug: User opens and closes SHORT - pnl SHOULD count', () => {
  // Compare: if user had closed the position, pnl WOULD count

  const trades: FightTrade[] = [
    {
      symbol: 'BTC-USD',
      side: 'SELL',
      amount: 0.0009,
      price: 87426,
      pnl: -0.0708,
      fee: 0.0708,
    },
    {
      symbol: 'BTC-USD',
      side: 'BUY',
      amount: 0.0009,
      price: 87000,  // Closed at lower price = profit
      pnl: 0.31,     // Profit from price difference minus fee
      fee: 0.0708,
    },
  ];

  const result = calculateFightPnl(trades);

  // Only closing trade's pnl counts
  expect(result.realizedPnl).toBeCloseTo(0.31);
  expect(Math.abs(result.positionsBySymbol['BTC-USD']!.amount)).toBeCloseTo(0); // Closed

  // PnL percent should reflect the realized profit
  const pnlPercent = calculatePnlPercent(
    result.realizedPnl,
    0,      // Closed
    1.58    // Max exposure
  );
  expect(pnlPercent).toBeCloseTo(19.62, 1); // ~19.6%
});

// ─────────────────────────────────────────────────────────────
// Test: No trades scenario
// ─────────────────────────────────────────────────────────────

test('No trades - pnl is 0', () => {
  const result = calculateFightPnl([]);

  expect(result.realizedPnl).toBe(0);
  expect(result.totalFees).toBe(0);
  expect(result.tradesCount).toBe(0);
});

test('Winner with 0 trades beats loser with negative pnl', () => {
  // User A: No trades = 0%
  // User B: Opened position, didn't close = 0% (per rules)
  // This should be a DRAW, not User A winning

  const userATrades: FightTrade[] = [];
  const userBTrades: FightTrade[] = [
    { symbol: 'BTC-USD', side: 'SELL', amount: 0.001, price: 50000, pnl: -0.05, fee: 0.05 },
  ];

  const resultA = calculateFightPnl(userATrades);
  const resultB = calculateFightPnl(userBTrades);

  expect(resultA.realizedPnl).toBe(0);
  expect(resultB.realizedPnl).toBe(0); // Opening trade doesn't count!

  // Both have 0% - should be a DRAW
  const pnlPercentA = calculatePnlPercent(resultA.realizedPnl, 0, 0);
  const pnlPercentB = calculatePnlPercent(resultB.realizedPnl, 0, 1);

  expect(pnlPercentA).toBe(0);
  expect(pnlPercentB).toBe(0);
});

// ─────────────────────────────────────────────────────────────
// Run tests
// ─────────────────────────────────────────────────────────────

async function runTests() {
  console.log('Running Fight PnL Calculator tests...\n');
  console.log('Testing compliance with Fight-Engine_Rules.md Rules 18-25\n');

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`  ✗ ${name}`);
      console.log(`    ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
runTests();

export { runTests };
