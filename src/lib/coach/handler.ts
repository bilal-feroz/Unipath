import { getCurriculum } from "@/lib/curriculum/registry";
import { cleanAnswer, extractJson, normalizeIdeas } from "./parse";
import type { AiProvider, AiTurn } from "./provider";
import { askPrompt, cleanText, COACH_SYSTEM_PROMPT, ideasPrompt, studentContext } from "./prompt";
import { createRateLimiter } from "./rate-limit";
import { coachRequestSchema, type CoachError, type CoachErrorCode, type CoachResponse, type IdeasResponse } from "./schema";

const perVisitor = createRateLimiter({ limit: 8, windowMs: 10 * 60_000 });
// Stays under the free tier's daily grounded-request allowance even if every instance is busy.
const perInstance = createRateLimiter({ limit: 400, windowMs: 24 * 60 * 60_000 });

const ideasCache = new Map<string, { at: number; value: IdeasResponse }>();
const CACHE_MS = 30 * 60_000;

function error(status: number, code: CoachErrorCode, message: string, headers: Record<string, string> = {}) {
  return Response.json({ error: code, message } satisfies CoachError, { status, headers });
}

export interface HandlerEnv {
  /** Null when no AI key is configured on the server. */
  provider: AiProvider | null;
  now?: () => Date;
}

/** POST /api/coach — project ideas and follow-up answers. Kept separate from the route file for testing. */
export async function handleCoachRequest(request: Request, env: HandlerEnv): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "bad_request", "The request wasn't valid JSON.");
  }
  const parsed = coachRequestSchema.safeParse(body);
  if (!parsed.success) return error(400, "bad_request", "The request was missing information or too long.");
  const req = parsed.data;
  const curriculum = getCurriculum(req.curriculumId);
  if (!curriculum) return error(400, "bad_request", "That study plan isn't available.");
  const question = cleanText(req.question, 600);
  if (req.mode === "ask" && !question) return error(400, "bad_request", "Type a question first.");

  const provider = env.provider;
  if (!provider) {
    return error(503, "not_configured", "The AI coach isn't set up on this server yet (no AI API key).");
  }

  const ctx = studentContext(curriculum, req);
  const cacheKey =
    req.mode === "ideas"
      ? JSON.stringify([
          provider.id,
          provider.model,
          curriculum.id,
          ctx.completed.map((c) => c.code).sort(),
          ctx.inProgress.map((c) => c.code).sort(),
          ctx.interests,
        ])
      : null;
  const now = env.now?.() ?? new Date();
  if (cacheKey) {
    const hit = ideasCache.get(cacheKey);
    if (hit && now.getTime() - hit.at < CACHE_MS) return Response.json(hit.value);
  }

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = perVisitor.check(visitor, now.getTime());
  if (!limited.ok) {
    return error(429, "rate_limited", "That's a lot of questions! Please wait a few minutes and try again.", {
      "Retry-After": String(limited.retryAfterSeconds),
    });
  }
  if (!perInstance.check("all", now.getTime()).ok) {
    return error(429, "quota", "The free AI quota for today is used up. Please try again tomorrow.");
  }

  const turns: AiTurn[] = [];
  if (req.mode === "ideas") {
    turns.push({ role: "user", text: ideasPrompt(ctx) });
  } else {
    for (const h of req.history ?? []) {
      const t = cleanText(h.text, 4000);
      if (t) turns.push({ role: h.role === "student" ? "user" : "model", text: t });
    }
    // The conversation must start with the student.
    while (turns[0]?.role === "model") turns.shift();
    turns.push({ role: "user", text: askPrompt(ctx, question!, (req.ideaTitles ?? []).map((t) => cleanText(t, 140) ?? "").filter(Boolean)) });
  }

  const result = await provider.call({
    system: COACH_SYSTEM_PROMPT,
    turns,
    search: req.mode === "ideas" ? "require" : "allow",
  });
  if (!result.ok) return error(result.status, result.error, result.message);
  const meta = {
    sources: result.sources,
    searchQueries: result.searchQueries,
    searched: result.searched,
    provider: provider.label,
    model: provider.model,
  };

  const generatedAt = now.toISOString();
  let response: CoachResponse;
  if (req.mode === "ideas") {
    const ideas = normalizeIdeas(extractJson(result.text), ctx.allowedCodes);
    if (!ideas) return error(502, "bad_output", "The AI's answer couldn't be read. Please try again.");
    response = { mode: "ideas", ...ideas, ...meta, generatedAt };
    if (cacheKey) {
      if (ideasCache.size > 200) ideasCache.clear();
      ideasCache.set(cacheKey, { at: now.getTime(), value: response });
    }
  } else {
    response = { mode: "ask", answer: cleanAnswer(result.text), ...meta, generatedAt };
  }
  return Response.json(response);
}
