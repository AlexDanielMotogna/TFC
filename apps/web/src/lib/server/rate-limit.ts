/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a Map<string, { count, resetAt }> keyed by IP address.
 * Not suitable for multi-instance deployments — use Redis-based
 * rate limiting in production if running multiple app instances.
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_LIMIT = 300; // requests per window (WS adapter needs ~30-50 on init)
const DEFAULT_WINDOW = 60_000; // 1 minute

/**
 * Check whether a request from `ip` is within the rate limit.
 *
 * @returns `true` if the request is allowed, `false` if rate-limited.
 */
export function checkRateLimit(
  ip: string,
  limit: number = DEFAULT_LIMIT,
  window: number = DEFAULT_WINDOW
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + window });
    return true;
  }

  entry.count++;
  return entry.count <= limit;
}

/**
 * Periodically purge expired entries to prevent unbounded memory growth.
 * Runs every 5 minutes.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60_000);
