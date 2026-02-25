/**
 * Nado Encoding Unit Tests
 *
 * Tests the core encoding/decoding functions used by the Nado adapter and order router:
 * - toX18 / fromX18: x18 fixed-point <-> human-readable number conversion
 * - encodeAppendix: 128-bit order appendix bit layout
 * - addressToSubaccount / subaccountToAddress: bytes32 subaccount encoding
 * - generateNonce: time-stamped nonce generation
 *
 * Run with: npx vitest run apps/web/src/lib/server/exchanges/__tests__/nado-encoding.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  toX18,
  fromX18,
  encodeAppendix,
  generateNonce,
  genOrderVerifyingContract,
} from '../nado-adapter';
import { addressToSubaccount, subaccountToAddress } from '@/lib/nado-utils';

// ─────────────────────────────────────────────────────────────
// 6.1: toX18 / fromX18
// ─────────────────────────────────────────────────────────────

describe('toX18', () => {
  it('should convert 1 to 1e18', () => {
    expect(toX18(1)).toBe('1000000000000000000');
  });

  it('should convert 0 to 0', () => {
    expect(toX18(0)).toBe('0');
  });

  it('should convert 0.001 to 1e15', () => {
    expect(toX18(0.001)).toBe('1000000000000000');
  });

  it('should convert 100.5 correctly', () => {
    // 100.5 * 1e18 = 100500000000000000000
    expect(toX18(100.5)).toBe('100500000000000000000');
  });

  it('should handle very small numbers (precision edge case)', () => {
    // 0.00000001 (1e-8) => 1e-8 * 1e18 = 1e10
    expect(toX18(0.00000001)).toBe('10000000000');
  });

  it('should handle very large numbers', () => {
    // 100000 * 1e18 = 1e23
    expect(toX18(100000)).toBe('100000000000000000000000');
  });

  it('should handle negative numbers', () => {
    // -1 * 1e18 = -1e18
    // Implementation: BigInt(Math.round(-1 * 1e8)) * BigInt(1e10)
    // = BigInt(-100000000) * BigInt(10000000000)
    // = -1000000000000000000
    expect(toX18(-1)).toBe('-1000000000000000000');
  });

  it('should handle negative fractional numbers', () => {
    expect(toX18(-0.5)).toBe('-500000000000000000');
  });

  it('should handle a typical BTC price like 95000.50', () => {
    expect(toX18(95000.5)).toBe('95000500000000000000000');
  });

  it('should handle a typical small amount like 0.01', () => {
    expect(toX18(0.01)).toBe('10000000000000000');
  });
});

describe('fromX18', () => {
  it('should convert 1e18 to 1', () => {
    expect(fromX18('1000000000000000000')).toBe(1);
  });

  it('should convert 0 to 0', () => {
    expect(fromX18('0')).toBe(0);
  });

  it('should convert 1e15 to 0.001', () => {
    expect(fromX18('1000000000000000')).toBe(0.001);
  });

  it('should convert 100.5e18 back to 100.5', () => {
    expect(fromX18('100500000000000000000')).toBe(100.5);
  });

  it('should convert negative x18 values', () => {
    expect(fromX18('-1000000000000000000')).toBe(-1);
  });

  it('should convert large values like 100000e18 (within floating-point tolerance)', () => {
    // fromX18 uses Number() division which has precision limits for very large x18 values
    expect(fromX18('100000000000000000000000')).toBeCloseTo(100000, 5);
  });
});

describe('toX18/fromX18 round-trip', () => {
  const testValues = [0, 1, -1, 0.5, 0.001, 100.5, 95000.5, 0.00000001, -42.123];

  for (const value of testValues) {
    it(`round-trip for ${value}`, () => {
      const x18 = toX18(value);
      const back = fromX18(x18);
      // Allow small floating-point epsilon for round-trip
      expect(Math.abs(back - value)).toBeLessThan(1e-8);
    });
  }

  it('round-trip for maximum safe integer boundary', () => {
    // The intermediate uses Math.round(value * 1e8), so max safe value is
    // Number.MAX_SAFE_INTEGER / 1e8 ~ 90071992.54740992
    // Test a value safely within that range
    const value = 1000000; // 1 million
    const x18 = toX18(value);
    const back = fromX18(x18);
    expect(back).toBe(value);
  });
});

// ─────────────────────────────────────────────────────────────
// 6.2: encodeAppendix bit layout
// ─────────────────────────────────────────────────────────────

describe('encodeAppendix', () => {
  /**
   * Bit layout (from source code):
   * - Bit 0: version = 1 (always set)
   * - Bit 8: isolated margin
   * - Bits 9-10: order type (DEFAULT=0, IOC=1, FOK=2, POST_ONLY=3)
   * - Bit 11: reduce_only
   * - Bits 12-13: trigger type (NONE=0, PRICE=1, TWAP=2)
   * - Bits 38-47: builder fee rate (10 bits, masked 0x3FF)
   * - Bits 48-63: builder ID (16 bits, masked 0xFFFF)
   */

  it('default appendix (GTC, no reduce, no trigger) should be "1" (version bit only)', () => {
    const result = encodeAppendix({});
    expect(result).toBe('1');
  });

  it('DEFAULT order type should still be "1" (0 shifted to bits 9-10 = no change)', () => {
    const result = encodeAppendix({ orderType: 'DEFAULT' });
    expect(result).toBe('1');
  });

  it('IOC should set bits 9-10 to 01 => 1 << 9 = 512, plus version = 513', () => {
    const result = encodeAppendix({ orderType: 'IOC' });
    const expected = BigInt(1) | (BigInt(1) << BigInt(9));
    expect(result).toBe(expected.toString()); // "513"
  });

  it('FOK should set bits 9-10 to 10 => 2 << 9 = 1024, plus version = 1025', () => {
    const result = encodeAppendix({ orderType: 'FOK' });
    const expected = BigInt(1) | (BigInt(2) << BigInt(9));
    expect(result).toBe(expected.toString()); // "1025"
  });

  it('POST_ONLY should set bits 9-10 to 11 => 3 << 9 = 1536, plus version = 1537', () => {
    const result = encodeAppendix({ orderType: 'POST_ONLY' });
    const expected = BigInt(1) | (BigInt(3) << BigInt(9));
    expect(result).toBe(expected.toString()); // "1537"
  });

  it('reduce_only should set bit 11 => 2048, plus version = 2049', () => {
    const result = encodeAppendix({ reduceOnly: true });
    const expected = BigInt(1) | (BigInt(1) << BigInt(11));
    expect(result).toBe(expected.toString()); // "2049"
  });

  it('IOC + reduce_only should be 512 + 2048 + 1 = 2561', () => {
    const result = encodeAppendix({ orderType: 'IOC', reduceOnly: true });
    const expected = BigInt(1) | (BigInt(1) << BigInt(9)) | (BigInt(1) << BigInt(11));
    expect(result).toBe(expected.toString()); // "2561"
  });

  it('isolated margin should set bit 8 => 256, plus version = 257', () => {
    const result = encodeAppendix({ isolated: true });
    const expected = BigInt(1) | (BigInt(1) << BigInt(8));
    expect(result).toBe(expected.toString()); // "257"
  });

  it('PRICE trigger should set bits 12-13 to 01 => 1 << 12 = 4096, plus version = 4097', () => {
    const result = encodeAppendix({ triggerType: 'PRICE' });
    const expected = BigInt(1) | (BigInt(1) << BigInt(12));
    expect(result).toBe(expected.toString()); // "4097"
  });

  it('TWAP trigger should set bits 12-13 to 10 => 2 << 12 = 8192, plus version = 8193', () => {
    const result = encodeAppendix({ triggerType: 'TWAP' });
    const expected = BigInt(1) | (BigInt(2) << BigInt(12));
    expect(result).toBe(expected.toString()); // "8193"
  });

  it('IOC + reduce_only + PRICE trigger', () => {
    const result = encodeAppendix({
      orderType: 'IOC',
      reduceOnly: true,
      triggerType: 'PRICE',
    });
    const expected =
      BigInt(1) |
      (BigInt(1) << BigInt(9)) | // IOC
      (BigInt(1) << BigInt(11)) | // reduce_only
      (BigInt(1) << BigInt(12)); // PRICE trigger
    expect(result).toBe(expected.toString()); // "6657"
  });

  it('builder fee rate at bits 38-47', () => {
    const feeRate = 10; // 10 = 1bps = 0.01%
    const result = encodeAppendix({ builderFee: feeRate, builderId: 0 });
    const expected = BigInt(1) | (BigInt(feeRate & 0x3ff) << BigInt(38));
    expect(result).toBe(expected.toString());

    // Verify the fee rate can be extracted from the result
    const value = BigInt(result);
    const extractedRate = Number((value >> BigInt(38)) & BigInt(0x3ff));
    expect(extractedRate).toBe(feeRate);
  });

  it('builder fee rate should mask to 10 bits (max 1023)', () => {
    const feeRate = 2000; // exceeds 10 bits (max 1023)
    const result = encodeAppendix({ builderFee: feeRate, builderId: 0 });
    const value = BigInt(result);
    const extractedRate = Number((value >> BigInt(38)) & BigInt(0x3ff));
    expect(extractedRate).toBe(2000 & 0x3ff); // Should be masked
  });

  it('builder ID at bits 48-63', () => {
    const builderId = 42;
    const result = encodeAppendix({ builderFee: 0, builderId });
    const expected = BigInt(1) | (BigInt(builderId & 0xffff) << BigInt(48));
    expect(result).toBe(expected.toString());

    // Verify extraction
    const value = BigInt(result);
    const extractedId = Number((value >> BigInt(48)) & BigInt(0xffff));
    expect(extractedId).toBe(builderId);
  });

  it('builder ID should mask to 16 bits (max 65535)', () => {
    const builderId = 70000; // exceeds 16 bits
    const result = encodeAppendix({ builderFee: 0, builderId });
    const value = BigInt(result);
    const extractedId = Number((value >> BigInt(48)) & BigInt(0xffff));
    expect(extractedId).toBe(70000 & 0xffff);
  });

  it('full combination: IOC + reduce + PRICE + builder', () => {
    const feeRate = 10;
    const builderId = 42;
    const result = encodeAppendix({
      orderType: 'IOC',
      reduceOnly: true,
      triggerType: 'PRICE',
      builderFee: feeRate,
      builderId,
    });

    const expected =
      BigInt(1) | // version
      (BigInt(1) << BigInt(9)) | // IOC
      (BigInt(1) << BigInt(11)) | // reduce_only
      (BigInt(1) << BigInt(12)) | // PRICE trigger
      (BigInt(feeRate & 0x3ff) << BigInt(38)) | // builder fee rate
      (BigInt(builderId & 0xffff) << BigInt(48)); // builder ID

    expect(result).toBe(expected.toString());

    // Verify all fields can be extracted
    const value = BigInt(result);
    expect(Number(value & BigInt(1))).toBe(1); // version
    expect(Number((value >> BigInt(8)) & BigInt(1))).toBe(0); // not isolated
    expect(Number((value >> BigInt(9)) & BigInt(3))).toBe(1); // IOC
    expect(Number((value >> BigInt(11)) & BigInt(1))).toBe(1); // reduce_only
    expect(Number((value >> BigInt(12)) & BigInt(3))).toBe(1); // PRICE
    expect(Number((value >> BigInt(38)) & BigInt(0x3ff))).toBe(feeRate);
    expect(Number((value >> BigInt(48)) & BigInt(0xffff))).toBe(builderId);
  });

  it('all flags set: isolated + POST_ONLY + reduce + TWAP + builder', () => {
    const result = encodeAppendix({
      orderType: 'POST_ONLY',
      reduceOnly: true,
      triggerType: 'TWAP',
      isolated: true,
      builderFee: 500,
      builderId: 1000,
    });

    const value = BigInt(result);
    expect(Number(value & BigInt(1))).toBe(1); // version
    expect(Number((value >> BigInt(8)) & BigInt(1))).toBe(1); // isolated
    expect(Number((value >> BigInt(9)) & BigInt(3))).toBe(3); // POST_ONLY
    expect(Number((value >> BigInt(11)) & BigInt(1))).toBe(1); // reduce_only
    expect(Number((value >> BigInt(12)) & BigInt(3))).toBe(2); // TWAP
    expect(Number((value >> BigInt(38)) & BigInt(0x3ff))).toBe(500);
    expect(Number((value >> BigInt(48)) & BigInt(0xffff))).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────
// 6.3: addressToSubaccount / subaccountToAddress
// ─────────────────────────────────────────────────────────────

describe('addressToSubaccount', () => {
  const testAddr = '0x835192aeC06e536CC641fb34123801EAECf4d067';
  const testAddrLower = testAddr.toLowerCase();

  it('should produce a 66-character hex string (0x + 64 hex chars = 32 bytes)', () => {
    const result = addressToSubaccount(testAddr);
    expect(result).toHaveLength(66);
    expect(result.startsWith('0x')).toBe(true);
  });

  it('should include the lowercase address in the first 20 bytes', () => {
    const result = addressToSubaccount(testAddr);
    const addrPart = result.slice(2, 42); // first 20 bytes = 40 hex chars
    expect(addrPart).toBe(testAddrLower.slice(2));
  });

  it('should encode the "default" name in bytes 20-31', () => {
    const result = addressToSubaccount(testAddr);
    // "default" = 64 65 66 61 75 6c 74 (7 bytes), padded to 12 bytes with zeros
    const namePart = result.slice(42); // last 12 bytes = 24 hex chars
    const expectedNameHex = Array.from(new TextEncoder().encode('default'))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .padEnd(24, '0');
    expect(namePart).toBe(expectedNameHex);
  });

  it('lowercase and checksum addresses should produce the same result', () => {
    const fromChecksum = addressToSubaccount(testAddr);
    const fromLower = addressToSubaccount(testAddrLower);
    expect(fromChecksum).toBe(fromLower);
  });

  it('should handle a custom subaccount name', () => {
    const result = addressToSubaccount(testAddr, 'test');
    const namePart = result.slice(42);
    const expectedNameHex = Array.from(new TextEncoder().encode('test'))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .padEnd(24, '0');
    expect(namePart).toBe(expectedNameHex);
  });

  it('should handle an empty name', () => {
    const result = addressToSubaccount(testAddr, '');
    const namePart = result.slice(42);
    // Empty string => all zeros for the name portion
    expect(namePart).toBe('0'.repeat(24));
  });
});

describe('subaccountToAddress', () => {
  const testAddr = '0x835192aeC06e536CC641fb34123801EAECf4d067';
  const testAddrLower = testAddr.toLowerCase();

  it('should extract the address from a subaccount', () => {
    const subaccount = addressToSubaccount(testAddr);
    const extracted = subaccountToAddress(subaccount);
    expect(extracted).toBe(testAddrLower);
  });

  it('should return a lowercased address', () => {
    const subaccount = addressToSubaccount(testAddr);
    const extracted = subaccountToAddress(subaccount);
    expect(extracted).toBe(extracted.toLowerCase());
  });

  it('round-trip: subaccountToAddress(addressToSubaccount(addr)) === addr.toLowerCase()', () => {
    const addresses = [
      '0x835192aeC06e536CC641fb34123801EAECf4d067',
      '0xD58A39887B037E68b0FA01808ac49336A0a28744',
      '0x0000000000000000000000000000000000000001',
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
    ];

    for (const addr of addresses) {
      const subaccount = addressToSubaccount(addr);
      const roundTripped = subaccountToAddress(subaccount);
      expect(roundTripped).toBe(addr.toLowerCase());
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 6.4: generateNonce
// ─────────────────────────────────────────────────────────────

describe('generateNonce', () => {
  it('should return a string', () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe('string');
  });

  it('should return a valid numeric string (parseable as BigInt)', () => {
    const nonce = generateNonce();
    expect(() => BigInt(nonce)).not.toThrow();
  });

  it('two consecutive calls should produce different nonces', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
  });

  it('extracted timestamp should be within ~2 seconds of Date.now()', () => {
    const before = Date.now();
    const nonce = generateNonce();
    const after = Date.now();

    // Upper bits = discard time in ms (Date.now() + 50), shifted left by 20
    const nonceBig = BigInt(nonce);
    const extractedTime = Number(nonceBig >> BigInt(20));

    // The extracted time is Date.now() + 50 at time of generation
    // So it should be between (before + 50) and (after + 50), with some tolerance
    expect(extractedTime).toBeGreaterThanOrEqual(before);
    expect(extractedTime).toBeLessThanOrEqual(after + 2000); // 2s tolerance
  });

  it('lower 20 bits should be the random portion', () => {
    const nonce = generateNonce();
    const nonceBig = BigInt(nonce);
    const randomPart = Number(nonceBig & BigInt(0xfffff)); // lower 20 bits
    // Random part should be between 0 and 999999 based on implementation
    expect(randomPart).toBeGreaterThanOrEqual(0);
    expect(randomPart).toBeLessThan(1000000);
  });

  it('nonce structure: (discardTime << 20) + random', () => {
    // Verify the nonce can be decomposed and recomposed
    const nonce = generateNonce();
    const nonceBig = BigInt(nonce);
    const timePart = nonceBig >> BigInt(20);
    const randomPart = nonceBig & BigInt(0xfffff);

    const recomposed = (timePart << BigInt(20)) + randomPart;
    expect(recomposed).toBe(nonceBig);
  });
});

// ─────────────────────────────────────────────────────────────
// Bonus: genOrderVerifyingContract
// ─────────────────────────────────────────────────────────────

describe('genOrderVerifyingContract', () => {
  it('should produce a 42-character hex address string', () => {
    const result = genOrderVerifyingContract(1);
    expect(result).toHaveLength(42); // "0x" + 40 hex chars
    expect(result.startsWith('0x')).toBe(true);
  });

  it('product ID 1 should be zero-padded to 40 hex chars', () => {
    const result = genOrderVerifyingContract(1);
    expect(result).toBe('0x' + '0'.repeat(39) + '1');
  });

  it('product ID 0 should be all zeros', () => {
    const result = genOrderVerifyingContract(0);
    expect(result).toBe('0x' + '0'.repeat(40));
  });

  it('product ID 256 (0x100) should be correctly padded', () => {
    const result = genOrderVerifyingContract(256);
    expect(result).toBe('0x' + '0'.repeat(37) + '100');
  });
});
