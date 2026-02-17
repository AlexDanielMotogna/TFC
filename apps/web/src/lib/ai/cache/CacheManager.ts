/**
 * AI Bias Cache Manager
 * In-memory cache with TTL and data-hash awareness.
 * Prevents redundant Claude calls when market data hasn't changed meaningfully.
 */

import type { CachedSignal, AiSignalResponse } from '../types/AiBias.types';
import { createHash } from 'crypto';
import type { MarketDataBundle } from '../types/AiBias.types';

const DEFAULT_TTL_MS = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 500;    // Maximum entries before LRU eviction

export class CacheManager {
  private cache = new Map<string, CachedSignal>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Build cache key from symbol + risk profile
   */
  static buildKey(symbol: string, riskProfile: string): string {
    return `${symbol}:${riskProfile}`;
  }

  /**
   * Compute a hash of market data to detect meaningful changes.
   * Uses latest candle closes and current price as fingerprint.
   */
  static computeDataHash(data: MarketDataBundle): string {
    const fingerprint = [
      data.snapshot.currentPrice.toFixed(2),
      data.snapshot.fundingRate.toFixed(6),
      data.snapshot.volume24h.toFixed(0),
      data.candles1h.slice(-5).map(c => c.close.toFixed(2)).join(','),
      data.candles4h.slice(-3).map(c => c.close.toFixed(2)).join(','),
    ].join('|');

    return createHash('md5').update(fingerprint).digest('hex').slice(0, 16);
  }

  /**
   * Get cached bias if valid (not expired and data hasn't changed).
   */
  get(key: string, currentDataHash?: string): AiSignalResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();

    // Check TTL
    if (now - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // If data hash is provided and differs, cache is stale
    if (currentDataHash && entry.dataHash !== currentDataHash) {
      return null;
    }

    return entry.response;
  }

  /**
   * Store bias result in cache.
   */
  set(key: string, response: AiSignalResponse, dataHash: string): void {
    // LRU eviction if cache is too large
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      response,
      dataHash,
      createdAt: Date.now(),
    });
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
