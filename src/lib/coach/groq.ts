import { retryAfterSeconds, type AiOutcome, type AiProvider, type AiTurn, type SearchMode } from "./provider";
import type { CoachSource } from "./schema";

/**
 * Groq's OpenAI-compatible chat completions API. gpt-oss models can search the web with Groq's
 * built-in `browser_search` tool, which runs on Groq's side. Server-side only.
 */

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface GroqSearchResult {
  title?: string;
  url?: string;
}

interface GroqResponseBody {
  choices?: {
    message?: {
      content?: string | null;
      executed_tools?: {
        type?: string;
        arguments?: string;
        search_results?: { results?: GroqSearchResult[] };
      }[];
    };
    finish_reason?: string;
  }[];
  error?: { message?: string; type?: string; code?: string };
}

/** gpt-oss marks citations inline like 【2†L6-L10】; they mean nothing to students. */
export function stripCitationMarkers(text: string): string {
  return text.replace(/【[^】]*】/g, "").replace(/[ \t]{2,}/g, " ");
}

function searchDetails(body: GroqResponseBody): { sources: CoachSource[]; queries: string[] } {
  const seen = new Set<string>();
  const sources: CoachSource[] = [];
  const queries: string[] = [];
  for (const tool of body.choices?.[0]?.message?.executed_tools ?? []) {
    try {
      const args = JSON.parse(tool.arguments ?? "{}") as { query?: unknown };
      if (typeof args.query === "string" && args.query.trim()) queries.push(args.query.trim().slice(0, 160));
    } catch {
      // Arguments are informational only.
    }
    for (const r of tool.search_results?.results ?? []) {
      if (!r.url || !/^https?:\/\//i.test(r.url) || seen.has(r.url)) continue;
      seen.add(r.url);
      let title = (r.title ?? "").trim();
      if (!title) {
        try {
          title = new URL(r.url).hostname;
        } catch {
          continue;
        }
      }
      sources.push({ title: title.slice(0, 120), url: r.url });
    }
  }
  return { sources: sources.slice(0, 8), queries: queries.slice(0, 6) };
}

async function request(
  apiKey: string,
  model: string,
  system: string,
  turns: AiTurn[],
  search: SearchMode | "off",
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<{ res: Response; body: GroqResponseBody } | null> {
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          ...turns.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text })),
        ],
        max_completion_tokens: 8192,
        temperature: 1,
        // Groq recommends low reasoning effort with browser search to keep sessions short.
        reasoning_effort: "low",
        ...(search === "off"
          ? {}
          : { tools: [{ type: "browser_search" }], tool_choice: search === "require" ? "required" : "auto" }),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let body: GroqResponseBody = {};
    try {
      body = (await res.json()) as GroqResponseBody;
    } catch {
      // Handled by the caller via status / empty content.
    }
    return { res, body };
  } catch {
    return null;
  }
}

/** True when a failed search request is worth retrying without the search tool. */
function searchCouldBeTheProblem(status: number, body: GroqResponseBody): boolean {
  const detail = `${body.error?.code ?? ""} ${body.error?.type ?? ""} ${body.error?.message ?? ""}`.toLowerCase();
  if (status === 413) return true;
  if (status === 429) return /tokens per minute|tpm|request too large/.test(detail);
  if (status === 400 || status === 403) return /tool|browser|search|not available|plan|too large/.test(detail);
  return false;
}

export async function callGroq({
  apiKey,
  model = DEFAULT_GROQ_MODEL,
  system,
  turns,
  search,
  fetchImpl = fetch,
  timeoutMs = 50_000,
}: {
  apiKey: string;
  model?: string;
  system: string;
  turns: AiTurn[];
  search: SearchMode;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<AiOutcome> {
  let searchUsed = true;
  let attempt = await request(apiKey, model, system, turns, search, fetchImpl, timeoutMs);
  // Live search adds a lot of tokens, which can exceed the free plan's per-minute limit. Retry once without it.
  if (attempt && !attempt.res.ok && searchCouldBeTheProblem(attempt.res.status, attempt.body)) {
    searchUsed = false;
    attempt = await request(apiKey, model, system, turns, "off", fetchImpl, timeoutMs);
  }
  if (!attempt) {
    return { ok: false, status: 504, error: "upstream", message: "The AI took too long to answer. Please try again." };
  }

  const { res, body } = attempt;
  if (!res.ok) {
    const detail = `${body.error?.code ?? ""} ${body.error?.message ?? ""}`;
    if (res.status === 401 || /invalid_api_key|invalid api key/i.test(detail)) {
      return {
        ok: false,
        status: 503,
        error: "not_configured",
        message: "The AI key on this server isn't valid. The site owner needs to update it.",
      };
    }
    if (res.status === 429) {
      const wait = retryAfterSeconds(res.headers.get("retry-after"), body.error?.message);
      return {
        ok: false,
        status: 429,
        error: "quota",
        message:
          wait !== undefined && wait > 60 * 60
            ? "Today's free AI allowance for this site is used up. Please try again tomorrow."
            : "The free AI allowance is busy right now. Please wait a moment and try again.",
        retryAfterSeconds: wait ?? 30,
      };
    }
    return {
      ok: false,
      status: res.status >= 500 ? 503 : 502,
      error: "upstream",
      message: "The AI service couldn't answer right now. Please try again in a moment.",
    };
  }

  const choice = body.choices?.[0];
  if (choice?.finish_reason === "content_filter") {
    return { ok: false, status: 422, error: "declined", message: "The AI declined to answer that. Try rephrasing." };
  }
  const text = stripCitationMarkers(choice?.message?.content ?? "").trim();
  if (!text) {
    return { ok: false, status: 502, error: "bad_output", message: "The AI sent an empty answer. Please try again." };
  }
  const details = searchDetails(body);
  return {
    ok: true,
    text,
    sources: details.sources,
    searchQueries: details.queries,
    searched: searchUsed && (choice?.message?.executed_tools?.length ?? 0) > 0,
  };
}

export function groqProvider({
  apiKey,
  model,
  fetchImpl,
}: {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): AiProvider {
  const resolved = model || DEFAULT_GROQ_MODEL;
  return {
    id: "groq",
    label: "Groq",
    model: resolved,
    privacyUrl: "https://console.groq.com/docs/your-data",
    privacyNote: "Groq says it doesn't use API requests to train models.",
    // Groq's free tier allows 30 requests a minute and 1,000 a day for gpt-oss-120b. A request can
    // make two calls (when search falls back), so stay at half of that.
    limits: { perMinute: 15, perDay: 450 },
    call: ({ system, turns, search }) => callGroq({ apiKey, model: resolved, system, turns, search, fetchImpl }),
  };
}
