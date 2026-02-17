/**
 * In-Memory Rate Limiter
 * Sliding window rate limiting per user.
 * Production-ready: auto-cleans expired entries to prevent memory leaks.
 */

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Auto-cleanup stale entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60_000);
  }

  /**
   * Check if a request is allowed. If allowed, records the request.
   * Returns { allowed, retryAfter } where retryAfter is seconds until next slot.
   */
  check(key: string): { allowed: boolean; retryAfter: number; remaining: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, { timestamps: [now] });
      return { allowed: true, retryAfter: 0, remaining: this.maxRequests - 1 };
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => now - t < this.windowMs);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + this.windowMs - now) / 1000);
      return { allowed: false, retryAfter, remaining: 0 };
    }

    entry.timestamps.push(now);
    return { allowed: true, retryAfter: 0, remaining: this.maxRequests - entry.timestamps.length };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      entry.timestamps = entry.timestamps.filter(t => now - t < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}
