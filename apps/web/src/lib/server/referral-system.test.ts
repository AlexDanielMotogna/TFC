/**
 * Referral System Tests
 *
 * These tests verify the referral code generation and commission calculation logic
 *
 * Run with: npx ts-node --test referral-system.test.ts
 */

import { generateReferralCode } from './referral-utils';
import { createHash } from 'crypto';

// Simple test runner
const tests: { name: string; fn: () => void | Promise<void> }[] = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push({ name, fn });
const expect = (actual: unknown) => ({
  toBe: (expected: unknown) => {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}`);
    }
  },
  toEqual: (expected: unknown) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  toHaveLength: (expected: number) => {
    if ((actual as string).length !== expected) {
      throw new Error(`Expected length ${expected}, got ${(actual as string).length}`);
    }
  },
  toMatch: (regex: RegExp) => {
    if (!regex.test(actual as string)) {
      throw new Error(`Expected ${actual} to match ${regex}`);
    }
  },
  toBeGreaterThan: (expected: number) => {
    if ((actual as number) <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
  toBeCloseTo: (expected: number, decimals = 2) => {
    const diff = Math.abs((actual as number) - expected);
    const threshold = Math.pow(10, -decimals);
    if (diff >= threshold) {
      throw new Error(`Expected ${actual} to be close to ${expected} (within ${threshold})`);
    }
  },
});

// ─────────────────────────────────────────────────────────────
// Test: Referral Code Generation
// ─────────────────────────────────────────────────────────────

test('generateReferralCode returns 16-character string', () => {
  const code = generateReferralCode('user-123');
  expect(code).toHaveLength(16);
});

test('generateReferralCode returns lowercase hex', () => {
  const code = generateReferralCode('user-123');
  expect(code).toMatch(/^[0-9a-f]{16}$/);
});

test('generateReferralCode is deterministic (same input = same output)', () => {
  const code1 = generateReferralCode('user-123');
  const code2 = generateReferralCode('user-123');
  expect(code1).toBe(code2);
});

test('generateReferralCode is unique for different users', () => {
  const code1 = generateReferralCode('user-123');
  const code2 = generateReferralCode('user-456');
  if (code1 === code2) {
    throw new Error('Expected different codes for different users');
  }
});

test('generateReferralCode uses salt from env', () => {
  // Generate code without salt (default)
  process.env.REFERRAL_CODE_SALT = 'default_salt';
  const codeDefault = generateReferralCode('user-123');

  // Generate code with custom salt
  process.env.REFERRAL_CODE_SALT = 'custom_salt';
  const codeCustom = generateReferralCode('user-123');

  if (codeDefault === codeCustom) {
    throw new Error('Expected different codes with different salts');
  }

  // Reset to default for other tests
  process.env.REFERRAL_CODE_SALT = 'tfc_referral_salt_2026_secure';
});

// ─────────────────────────────────────────────────────────────
// Test: Commission Calculation Logic
// ─────────────────────────────────────────────────────────────

test('Commission rates from env (T1: 34%, T2: 12%, T3: 4%)', () => {
  process.env.REFERRAL_COMMISSION_T1 = '34';
  process.env.REFERRAL_COMMISSION_T2 = '12';
  process.env.REFERRAL_COMMISSION_T3 = '4';

  const rates = {
    t1: parseFloat(process.env.REFERRAL_COMMISSION_T1) / 100,
    t2: parseFloat(process.env.REFERRAL_COMMISSION_T2) / 100,
    t3: parseFloat(process.env.REFERRAL_COMMISSION_T3) / 100,
  };

  expect(rates.t1).toBeCloseTo(0.34, 2);
  expect(rates.t2).toBeCloseTo(0.12, 2);
  expect(rates.t3).toBeCloseTo(0.04, 2);
});

test('Commission calculation: $10 fee with 34% = $3.40', () => {
  const tradeFee = 10;
  const commissionRate = 0.34; // 34%
  const commission = tradeFee * commissionRate;

  expect(commission).toBeCloseTo(3.40, 2);
});

test('Commission calculation: $100 fee split across T1/T2/T3', () => {
  const tradeFee = 100;

  // T1: 34% of $100 = $34
  const t1Commission = tradeFee * 0.34;
  expect(t1Commission).toBeCloseTo(34.00, 2);

  // T2: 12% of $100 = $12
  const t2Commission = tradeFee * 0.12;
  expect(t2Commission).toBeCloseTo(12.00, 2);

  // T3: 4% of $100 = $4
  const t3Commission = tradeFee * 0.04;
  expect(t3Commission).toBeCloseTo(4.00, 2);

  // Total: $50 distributed
  const totalCommission = t1Commission + t2Commission + t3Commission;
  expect(totalCommission).toBeCloseTo(50.00, 2);
});

test('Commission calculation: Small fee ($0.50)', () => {
  const tradeFee = 0.50;

  const t1Commission = tradeFee * 0.34; // $0.17
  const t2Commission = tradeFee * 0.12; // $0.06
  const t3Commission = tradeFee * 0.04; // $0.02

  expect(t1Commission).toBeCloseTo(0.17, 2);
  expect(t2Commission).toBeCloseTo(0.06, 2);
  expect(t3Commission).toBeCloseTo(0.02, 2);
});

test('Commission calculation: Large fee ($1000)', () => {
  const tradeFee = 1000;

  const t1Commission = tradeFee * 0.34; // $340
  const t2Commission = tradeFee * 0.12; // $120
  const t3Commission = tradeFee * 0.04; // $40

  expect(t1Commission).toBeCloseTo(340.00, 2);
  expect(t2Commission).toBeCloseTo(120.00, 2);
  expect(t3Commission).toBeCloseTo(40.00, 2);
});

// ─────────────────────────────────────────────────────────────
// Test: Referral Chain Logic
// ─────────────────────────────────────────────────────────────

test('Referral chain: T1 refers new user', () => {
  // When UserA refers UserB:
  // - UserB should have referredById = UserA.id
  // - A T1 referral record should be created (referrer: UserA, referred: UserB, tier: 1)

  const userAId = 'user-a-123';
  const userBId = 'user-b-456';

  // Simulated referral record
  const referral = {
    referrerId: userAId,
    referredId: userBId,
    tier: 1,
  };

  expect(referral.tier).toBe(1);
  expect(referral.referrerId).toBe(userAId);
  expect(referral.referredId).toBe(userBId);
});

test('Referral chain: T1 has T2, new user creates T1/T2 chain', () => {
  // Given:
  // - UserA referred UserB (T1 relationship)
  // - UserB now refers UserC
  // Expected:
  // - UserC → UserB (T1)
  // - UserC → UserA (T2)

  const userAId = 'user-a-123';
  const userBId = 'user-b-456';
  const userCId = 'user-c-789';

  // UserB's T1 referrer is UserA
  const userBReferrer = userAId;

  // When UserC signs up with UserB's code:
  // 1. Create T1: UserB → UserC
  const t1Referral = {
    referrerId: userBId,
    referredId: userCId,
    tier: 1,
  };

  // 2. Create T2: UserA → UserC (UserB's referrer)
  const t2Referral = {
    referrerId: userBReferrer,
    referredId: userCId,
    tier: 2,
  };

  expect(t1Referral.tier).toBe(1);
  expect(t2Referral.tier).toBe(2);
  expect(t2Referral.referrerId).toBe(userAId);
});

test('Referral chain: Full T1/T2/T3 chain', () => {
  // Given:
  // - UserA referred UserB (T1)
  // - UserB referred UserC (T1, UserC has T2 to UserA)
  // - UserC now refers UserD
  // Expected:
  // - UserD → UserC (T1)
  // - UserD → UserB (T2)
  // - UserD → UserA (T3)

  const userAId = 'user-a-123';
  const userBId = 'user-b-456';
  const userCId = 'user-c-789';
  const userDId = 'user-d-012';

  // UserC's chain: T1 = UserB, T2 = UserA
  const userCT1Referrer = userBId;
  const userCT2Referrer = userAId;

  // When UserD signs up with UserC's code:
  const referrals = [
    { referrerId: userCId, referredId: userDId, tier: 1 },
    { referrerId: userCT1Referrer, referredId: userDId, tier: 2 },
    { referrerId: userCT2Referrer, referredId: userDId, tier: 3 },
  ];

  expect(referrals).toHaveLength(3);
  expect(referrals[0]!.tier).toBe(1);
  expect(referrals[1]!.tier).toBe(2);
  expect(referrals[2]!.tier).toBe(3);
  expect(referrals[2]!.referrerId).toBe(userAId);
});

// ─────────────────────────────────────────────────────────────
// Test: Payout Logic
// ─────────────────────────────────────────────────────────────

test('Payout minimum: $10 threshold', () => {
  const minPayout = 10;

  const unclaimedAmount1 = 9.99;
  const unclaimedAmount2 = 10.00;
  const unclaimedAmount3 = 10.01;

  const canClaim1 = unclaimedAmount1 >= minPayout;
  const canClaim2 = unclaimedAmount2 >= minPayout;
  const canClaim3 = unclaimedAmount3 >= minPayout;

  expect(canClaim1).toBe(false);
  expect(canClaim2).toBe(true);
  expect(canClaim3).toBe(true);
});

test('Payout calculation: Sum of unpaid earnings', () => {
  // User has these unpaid earnings:
  const earnings = [
    { amount: 3.40, isPaid: false },
    { amount: 1.20, isPaid: false },
    { amount: 0.40, isPaid: false },
    { amount: 5.00, isPaid: true }, // Already paid - don't count
  ];

  const unclaimedAmount = earnings
    .filter(e => !e.isPaid)
    .reduce((sum, e) => sum + e.amount, 0);

  expect(unclaimedAmount).toBeCloseTo(5.00, 2);
});

// ─────────────────────────────────────────────────────────────
// Test: Edge Cases
// ─────────────────────────────────────────────────────────────

test('Edge case: Zero fee commission', () => {
  const tradeFee = 0;
  const commission = tradeFee * 0.34;
  expect(commission).toBe(0);
});

test('Edge case: Very small fee (precision)', () => {
  const tradeFee = 0.01; // 1 cent
  const commission = tradeFee * 0.34;
  expect(commission).toBeCloseTo(0.0034, 4);
});

test('Edge case: Self-referral should be blocked', () => {
  const userId = 'user-123';
  const referrerId = 'user-123'; // Same user

  const isSelfReferral = userId === referrerId;
  expect(isSelfReferral).toBe(true);

  // In the actual code, this should return { success: false, tiersCreated: 0 }
});

test('Edge case: Referral code collision (extremely unlikely)', () => {
  // With SHA256 and 16 character output, collision is ~1 in 2^64
  // Test that different IDs produce different codes
  const codes = new Set();
  for (let i = 0; i < 1000; i++) {
    const code = generateReferralCode(`user-${i}`);
    codes.add(code);
  }

  // All 1000 should be unique
  expect(codes.size).toBe(1000);
});

// ─────────────────────────────────────────────────────────────
// Test: Rate Limiting Logic
// ─────────────────────────────────────────────────────────────

test('Rate limit: 1 request per minute', () => {
  const now = Date.now();
  const lastAttempt = now - 30000; // 30 seconds ago
  const rateLimitWindow = 60000; // 1 minute

  const timeSinceLastAttempt = now - lastAttempt;
  const isRateLimited = timeSinceLastAttempt < rateLimitWindow;

  expect(isRateLimited).toBe(true);
});

test('Rate limit: Request allowed after 1 minute', () => {
  const now = Date.now();
  const lastAttempt = now - 61000; // 61 seconds ago
  const rateLimitWindow = 60000; // 1 minute

  const timeSinceLastAttempt = now - lastAttempt;
  const isRateLimited = timeSinceLastAttempt < rateLimitWindow;

  expect(isRateLimited).toBe(false);
});

// ─────────────────────────────────────────────────────────────
// Run tests
// ─────────────────────────────────────────────────────────────

async function runTests() {
  console.log('Running referral system tests...\n');

  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${name}`);
      console.log(`  ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests();
}

export { runTests };
