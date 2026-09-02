/**
 * In-Memory Rate Limiter
 *
 * IMPORTANT: This is a single-instance in-memory rate limiter.
 * For production deployments with multiple instances/containers,
 * replace with a distributed solution (Redis, Upstash, etc.).
 *
 * Current Limitations:
 * - Rate limits are NOT shared across multiple server instances
 * - Rate limits are reset on server restart
 * - Not suitable for horizontally scaled deployments
 *
 * Protected Endpoints:
 * - /api/v1/auth/login (10 attempts / 15 min per IP)
 * - /api/v1/auth/mfa/verify (10 attempts / 15 min per IP)
 * - /api/v1/auth/register (5 attempts / 1 hour per IP)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetMs: windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetMs: entry.resetAt - now,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    limit,
    remaining: limit - entry.count,
    resetMs: entry.resetAt - now,
  };
}
