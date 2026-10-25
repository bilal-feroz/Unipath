import type { AiProvider } from "./provider";
import { createConcurrencyLimiter, createRateLimiter, type RateWindow } from "./rate-limit";
import type { CoachErrorCode } from "./schema";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * How often one visitor (one IP address) may use the coach. Cached answers don't count. The limits are
 * generous enough for a room of students sharing one campus network.
 */
export type GuardMode = "ideas" | "ask" | "extract";

export const VISITOR_LIMITS: Record<GuardMode, RateWindow[]> = {
  extract: [
    { limit: 5, windowMs: 10 * MINUTE },
    { limit: 20, windowMs: DAY },
  ],
  ideas: [
    { limit: 4, windowMs: 10 * MINUTE },
    { limit: 15, windowMs: DAY },
  ],
  ask: [
    { limit: 5, windowMs: MINUTE },
    { limit: 20, windowMs: 10 * MINUTE },
    { limit: 60, windowMs: DAY },
  ],
};

/** AI requests one server instance runs at the same time, across all visitors. */
export const MAX_PARALLEL = 4;

export type GuardResult =
  | { ok: true; done: () => void }
  | { ok: false; status: number; error: CoachErrorCode; message: string; retryAfterSeconds: number };

function reject(error: CoachErrorCode, message: string, retryAfterSeconds: number): GuardResult {
  return { ok: false, status: 429, error, message, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)) };
}

/**
 * Decides whether a coach request may call the AI provider. Checks, in order: a pause requested by the
 * provider itself, one request at a time per visitor, the visitor's own limits, the server's parallel
 * limit, and the provider's free-tier limits. A request only counts against a limit when it is let through.
 */
export function createCoachGuard() {
  const visitorLimits = {
    ideas: createRateLimiter(VISITOR_LIMITS.ideas),
    ask: createRateLimiter(VISITOR_LIMITS.ask),
    extract: createRateLimiter(VISITOR_LIMITS.extract),
  };
  const visitorRunning = createConcurrencyLimiter(1);
  const serverRunning = createConcurrencyLimiter(MAX_PARALLEL);
  const providerLimits = new Map<string, ReturnType<typeof createRateLimiter>>();
  let pausedUntil = 0;

  const forProvider = (p: AiProvider) => {
    const key = `${p.id}:${p.model}`;
    let limiter = providerLimits.get(key);
    if (!limiter) {
      limiter = createRateLimiter([
        { limit: p.limits.perMinute, windowMs: MINUTE },
        { limit: p.limits.perDay, windowMs: DAY },
      ]);
      providerLimits.set(key, limiter);
    }
    return limiter;
  };

  return {
    admit({ visitor, mode, provider, now }: { visitor: string; mode: GuardMode; provider: AiProvider; now: number }): GuardResult {
      if (now < pausedUntil) {
        return reject("quota", "The free AI service asked UniPath to slow down. Please wait a moment and try again.", (pausedUntil - now) / 1000);
      }
      if (!visitorRunning.canStart(visitor)) {
        return reject("rate_limited", "The coach is still working on your last request. Wait for it to finish, then try again.", 5);
      }
      const own = visitorLimits[mode].peek(visitor, now);
      if (!own.ok) {
        return reject(
          "rate_limited",
          own.retryAfterSeconds > 60 * 60
            ? "You've reached today's limit for the coach. Please come back tomorrow."
            : mode === "ideas"
              ? "That's a lot of new ideas in a short time! Please wait a little before asking for more."
              : mode === "extract"
                ? "That's a lot of documents in a short time. Please wait a little, or use the offline reader."
                : "That's a lot of questions in a short time! Please wait a little before asking more.",
          own.retryAfterSeconds,
        );
      }
      if (!serverRunning.canStart("all")) {
        return reject("busy", "The coach is helping a lot of students right now. Please try again in a few seconds.", 5);
      }
      const shared = forProvider(provider).peek("all", now);
      if (!shared.ok) {
        return reject(
          "quota",
          shared.retryAfterSeconds > 60 * 60
            ? "Today's free AI allowance for this site is used up. Please try again tomorrow."
            : "The free AI allowance is busy right now. Please wait a moment and try again.",
          shared.retryAfterSeconds,
        );
      }

      visitorLimits[mode].record(visitor, now);
      forProvider(provider).record("all", now);
      visitorRunning.start(visitor);
      serverRunning.start("all");
      let finished = false;
      return {
        ok: true,
        done() {
          if (finished) return;
          finished = true;
          visitorRunning.finish(visitor);
          serverRunning.finish("all");
        },
      };
    },

    /** The provider said to slow down: pause every request until it is ready again (at most a day). */
    pause(seconds: number, now: number) {
      pausedUntil = Math.max(pausedUntil, now + Math.min(Math.max(seconds, 1), 24 * 60 * 60) * 1000);
    },
  };
}

export type CoachGuard = ReturnType<typeof createCoachGuard>;

/** One guard for every AI feature on this server instance, so their limits add up. */
export const sharedGuard = createCoachGuard();

/** Vercel sets x-real-ip and x-forwarded-for itself, so visitors can't choose their own. */
export function visitorId(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}
