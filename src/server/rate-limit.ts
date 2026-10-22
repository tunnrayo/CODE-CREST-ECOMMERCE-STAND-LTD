/**
 * Simple in-memory fixed-window rate limiter.
 * Suitable for a single instance. For multiple instances, replace with a
 * shared store (e.g. Redis/Upstash) behind the same function signature.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterMs: number } {
  if (process.env.DISABLE_RATE_LIMIT === "true") return { allowed: true, remaining: limit, retryAfterMs: 0 };
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfterMs: b.resetAt - now };
}

export function resetRateLimits() {
  buckets.clear();
}
