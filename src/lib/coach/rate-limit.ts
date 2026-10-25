/**
 * Small in-memory limiters. Each server instance keeps its own counts, so these protect the free AI
 * quota from accidental or casual overuse; they are not a security boundary.
 */

export interface RateWindow {
  limit: number;
  windowMs: number;
}

export interface RateDecision {
  ok: boolean;
  /** Seconds until the request would be allowed (0 when it is). */
  retryAfterSeconds: number;
  /** Requests left in the tightest window, counting this one if it is recorded. */
  remaining: number;
}

/** Sliding-window limiter over one or more windows (e.g. per minute and per day). */
export function createRateLimiter(windows: RateWindow | RateWindow[]) {
  const list = Array.isArray(windows) ? windows : [windows];
  const longest = Math.max(...list.map((w) => w.windowMs));
  const hits = new Map<string, number[]>();

  const recentFor = (key: string, now: number) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < longest);
    if (recent.length > 0) hits.set(key, recent);
    else hits.delete(key);
    return recent;
  };

  /** Whether one more request is allowed now, without counting it. */
  const peek = (key: string, now: number = Date.now()): RateDecision => {
    const recent = recentFor(key, now);
    let retryAt = 0;
    let remaining = Infinity;
    for (const w of list) {
      const inWindow = recent.filter((t) => now - t < w.windowMs);
      remaining = Math.min(remaining, w.limit - inWindow.length - 1);
      // The oldest hits have to expire until there is room for one more.
      if (inWindow.length >= w.limit) retryAt = Math.max(retryAt, inWindow[inWindow.length - w.limit] + w.windowMs);
    }
    return retryAt > 0
      ? { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)), remaining: 0 }
      : { ok: true, retryAfterSeconds: 0, remaining: Math.max(0, remaining) };
  };

  const record = (key: string, now: number = Date.now()) => {
    const recent = recentFor(key, now);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, times] of hits) if (times.every((t) => now - t >= longest)) hits.delete(k);
    }
  };

  return {
    peek,
    record,
    /** Counts the request if it is allowed. */
    check(key: string, now: number = Date.now()): RateDecision {
      const decision = peek(key, now);
      if (decision.ok) record(key, now);
      return decision;
    },
  };
}

/** Limits how many requests per key can run at the same time. */
export function createConcurrencyLimiter(max: number) {
  const running = new Map<string, number>();
  return {
    canStart: (key: string) => (running.get(key) ?? 0) < max,
    start(key: string) {
      running.set(key, (running.get(key) ?? 0) + 1);
    },
    finish(key: string) {
      const n = (running.get(key) ?? 0) - 1;
      if (n > 0) running.set(key, n);
      else running.delete(key);
    },
  };
}
