/**
 * A small in-memory sliding-window limiter. Each server instance keeps its own counts, so this is a
 * guard against accidental hammering of the free AI quota, not a security boundary.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now: number = Date.now()): { ok: boolean; retryAfterSeconds: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) {
        for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
      }
      return { ok: true, retryAfterSeconds: 0 };
    },
  };
}
