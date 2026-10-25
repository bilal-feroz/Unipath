import { sourcesFrom } from "./parse";
import type { CoachErrorCode, CoachSource } from "./schema";

/**
 * Calls Google's Gemini API (generateContent) with Google Search grounding.
 * Server-side only: the API key never reaches the browser.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

export type GeminiOutcome =
  | { ok: true; text: string; sources: CoachSource[]; searchQueries: string[] }
  | { ok: false; status: number; error: CoachErrorCode; message: string };

interface GeminiResponseBody {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
      webSearchQueries?: string[];
    };
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

const DECLINED_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

export async function callGemini({
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  system,
  turns,
  fetchImpl = fetch,
  timeoutMs = 50_000,
}: {
  apiKey: string;
  model?: string;
  system: string;
  turns: GeminiTurn[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<GeminiOutcome> {
  let res: Response;
  try {
    res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        tools: [{ googleSearch: {} }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, status: 504, error: "upstream", message: "The AI took too long to answer. Please try again." };
  }

  let data: GeminiResponseBody = {};
  try {
    data = (await res.json()) as GeminiResponseBody;
  } catch {
    // Handled below by status / empty text.
  }

  if (!res.ok) {
    const detail = `${data.error?.status ?? ""} ${data.error?.message ?? ""}`;
    if (res.status === 429) {
      return {
        ok: false,
        status: 429,
        error: "quota",
        message: "The free AI quota is used up for now. Please try again later.",
      };
    }
    if ((res.status === 400 || res.status === 401 || res.status === 403) && /api key|permission|unauthenticated/i.test(detail)) {
      return {
        ok: false,
        status: 503,
        error: "not_configured",
        message: "The AI key on this server isn't valid. The site owner needs to update it.",
      };
    }
    return {
      ok: false,
      status: res.status >= 500 ? 503 : 502,
      error: "upstream",
      message: "The AI service couldn't answer right now. Please try again in a moment.",
    };
  }

  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || DECLINED_REASONS.has(candidate?.finishReason ?? "")) {
    return { ok: false, status: 422, error: "declined", message: "The AI declined to answer that. Try rephrasing." };
  }
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) {
    return { ok: false, status: 502, error: "bad_output", message: "The AI sent an empty answer. Please try again." };
  }
  return {
    ok: true,
    text,
    sources: sourcesFrom(candidate?.groundingMetadata?.groundingChunks),
    searchQueries: (candidate?.groundingMetadata?.webSearchQueries ?? []).slice(0, 6),
  };
}
