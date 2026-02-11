/**
 * Fight Exposure Calculation Tests
 *
 * Tests the exposure calculation logic for MVP stake limit enforcement.
 * @see MVP-SIMPLIFIED-RULES.md - Stake Limit section
 *
 * Run with: npx ts-node src/lib/server/fight-exposure.test.ts
 */

import {
  calculateExposureFromTrades,
  calculateAvailableCapital,
} from './fight-exposure';

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
// Test: Exposure Calculation from Trades
// ─────────────────────────────────────────────────────────────

test('Empty trades - exposure should be 0', () => {
  const result = calculateExposureFromTrades([]);
  expect(result.currentExposure).toBe(0);
});

test('Single BUY - exposure equals notional value', () => {
  const trades = [
    { symbol: 'BTC-USD', side: 'BUY', amount: '0.001', price: '50000' },
  ];
  const result = calculateExposureFromTrades(trades);
  expect(result.currentExposure).toBeCloseTo(50); // 0.001 * 50000 = 50
});

test('Single SELL (open SHORT) - exposure equals notional value', () => {
  const trades = [
    { symbol: 'BTC-USD', side: 'SELL', amount: '0.001', price: '50000' },
  ];
  const result = calculateExposureFromTrades(trades);
  expect(result.currentExposure).toBeCloseTo(50); // abs(0.001) * 50000 = 50
});

test('Open and close LONG - exposure should be 0', () => {
  const trades = [
    { symbol: 'BTC-USD', side: 'BUY', amount: '0.001', price: '50000' },
    { symbol: 'BTC-USD', side: 'SELL', amount: '0.001', price: '51000' },
  ];
  const result = calculateExposureFromTrades(trades);
  expect(result.currentExposure).toBeCloseTo(0); // Position closed
});

test('Open and close SHORT - exposure should be 0', () => {
  const trades = [
    { symbol: 'BTC-USD', side: 'SELL', amount: '0.001', price: '50000' },
    { symbol: 'BTC-USD', side: 'BUY', amount: '0.001', price: '49000' },
  ];
  const result = calculateExposureFromTrades(trades);
  expect(result.currentExposure).toBeCloseTo(0); // Position closed
});

test('Multiple symbols - exposure is sum of all positions', () => {
  const trades = [
    { symbol: 'BTC-USD', side: 'BUY', amount: '0.001', price: '50000' },
    { symbol: 'ETH-USD', side: 'BUY', amount: '0.1', price: '3000' },
  ];
  const result = calculateExposureFromTrades(trades);
  // BTC: 0.001 * 50000 = 50
  // ETH: 0.1 * 3000 = 300
  expect(result.currentExposure).toBeCloseTo(350);
});

test('Partial close - exposure is remaining position', () => {
  const trades = [
    { symbol: 'BTC-USD', side: 'BUY', amount: '0.002', price: '50000' },
    { symbol: 'BTC-USD', side: 'SELL', amount: '0.001', price: '51000' },
  ];
  const result = calculateExposureFromTrades(trades);
  // Remaining: 0.001 BTC at avg entry ~50000 = 50
  expect(result.currentExposure).toBeCloseTo(50);
});

test('Flip position LONG to SHORT', () => {
  const trades = [
    { symbol: 'BTC-USD', side: 'BUY', amount: '0.001', price: '50000' },
    { symbol: 'BTC-USD', side: 'SELL', amount: '0.002', price: '51000' }, // Close LONG + open SHORT
  ];
  const result = calculateExposureFromTrades(trades);
  // New SHORT: 0.001 at 51000 = 51
  expect(result.currentExposure).toBeCloseTo(51);
  expect(result.positionsBySymbol['BTC-USD']!.amount).toBeCloseTo(-0.001);
});

// ─────────────────────────────────────────────────────────────
// Test: Available Capital Calculation
// ─────────────────────────────────────────────────────────────

test('Available capital - no usage', () => {
  const available = calculateAvailableCapital(100, 0, 0);
  expect(available).toBe(100);
});

test('Available capital - partial usage', () => {
  // Stake: 100, maxUsed: 50, current: 0 (closed)
  const available = calculateAvailableCapital(100, 50, 0);
  expect(available).toBe(50); // Can only use remaining 50
});

test('Available capital - with open position can reuse', () => {
  // Stake: 100, maxUsed: 80, current: 80 (open)
  // Can close and reopen up to 100
  const available = calculateAvailableCapital(100, 80, 80);
  expect(available).toBe(100);
});

test('Available capital - fully used then closed', () => {
  // Stake: 100, maxUsed: 100, current: 0 (all closed)
  const available = calculateAvailableCapital(100, 100, 0);
  expect(available).toBe(0); // All stake has been used
});

test('Available capital - never goes negative', () => {
  // Edge case: maxUsed > stake (shouldn't happen, but handle gracefully)
  const available = calculateAvailableCapital(100, 150, 0);
  expect(available).toBe(0); // Clamp to 0
});

// ─────────────────────────────────────────────────────────────
// Test: Dust Position Handling
// ─────────────────────────────────────────────────────────────

test('Dust position below threshold - treated as closed', () => {
  const trades = [
    { symbol: 'BTC-USD', side: 'BUY', amount: '0.001', price: '50000' },
    { symbol: 'BTC-USD', side: 'SELL', amount: '0.00099999999', price: '51000' }, // Almost closed
  ];
  const result = calculateExposureFromTrades(trades);
  // Remaining dust should be ignored
  expect(result.currentExposure).toBeCloseTo(0, 2);
});

// ─────────────────────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🧪 Running Fight Exposure Tests...\n');
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      t.fn();
      console.log(`  ✅ ${t.name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${t.name}`);
      console.log(`     ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
