import type { CoachErrorCode, CoachSource } from "./schema";

/** One turn of the conversation sent to an AI provider. */
export interface AiTurn {
  role: "user" | "model";
  text: string;
}

export type AiOutcome =
  | { ok: true; text: string; sources: CoachSource[]; searchQueries: string[]; searched: boolean }
  | { ok: false; status: number; error: CoachErrorCode; message: string };

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
  /** "require": always search the web first (project ideas). "allow": search only if useful (follow-ups). */
  call(args: { system: string; turns: AiTurn[]; search: SearchMode }): Promise<AiOutcome>;
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
