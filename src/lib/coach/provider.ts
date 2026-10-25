import type { CoachErrorCode, CoachSource } from "./schema";

/** One turn of the conversation sent to an AI provider. */
export interface AiTurn {
  role: "user" | "model";
  text: string;
}

export type AiOutcome =
  | { ok: true; text: string; sources: CoachSource[]; searchQueries: string[]; searched: boolean }
  | { ok: false; status: number; error: CoachErrorCode; message: string; retryAfterSeconds?: number };

export type ProviderId = "groq" | "gemini";

export type SearchMode = "require" | "allow";

/** A configured AI provider. Built on the server from environment variables; never sent to the browser. */
export interface AiProvider {
  id: ProviderId;
  /** Company name shown to students, e.g. "Groq". */
  label: string;
  model: string;
  /** Where students can read how the provider handles API data. */
  privacyUrl: string;
  /** Short, accurate statement about how the provider treats requests. */
  privacyNote: string;
  /** Requests this server lets through, kept safely under the provider's free tier. */
  limits: { perMinute: number; perDay: number };
  /** "require": always search the web first (project ideas). "allow": search only if useful (follow-ups). */
  call(args: { system: string; turns: AiTurn[]; search: SearchMode }): Promise<AiOutcome>;
}

/**
 * How long a provider asked us to wait, from a Retry-After header or wording such as
 * "try again in 1m30.5s" / a "17s" retry delay. Undefined when it didn't say.
 */
export function retryAfterSeconds(header: string | null | undefined, ...texts: (string | undefined)[]): number | undefined {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  for (const text of texts) {
    if (!text) continue;
    const phrase = (text.match(/try again in\s*([\dhms.]+)/i)?.[1] ?? text).trim().replace(/\.+$/, "");
    const m = phrase.match(/^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?$/i);
    if (m && (m[1] || m[2] || m[3])) return Math.ceil(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0));
  }
  return undefined;
}

/** What the browser may know about the server's AI setup. */
export interface CoachStatus {
  configured: boolean;
  provider: ProviderId | null;
  label: string | null;
  model: string | null;
  privacyUrl: string | null;
  privacyNote: string | null;
}

export function statusOf(provider: AiProvider | null): CoachStatus {
  return provider
    ? {
        configured: true,
        provider: provider.id,
        label: provider.label,
        model: provider.model,
        privacyUrl: provider.privacyUrl,
        privacyNote: provider.privacyNote,
      }
    : { configured: false, provider: null, label: null, model: null, privacyUrl: null, privacyNote: null };
}
