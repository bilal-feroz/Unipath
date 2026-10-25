import { getCurriculum } from "@/lib/curriculum/registry";
import { cleanAnswer, extractJson, normalizeIdeas } from "./parse";
import { createCoachGuard, type CoachGuard } from "./guard";
import type { AiProvider, AiTurn } from "./provider";
import { askPrompt, cleanText, COACH_SYSTEM_PROMPT, ideasPrompt, studentContext } from "./prompt";
import { coachRequestSchema, type CoachError, type CoachErrorCode, type CoachResponse, type IdeasResponse } from "./schema";

const sharedGuard = createCoachGuard();

const ideasCache = new Map<string, { at: number; value: IdeasResponse }>();
const CACHE_MS = 30 * 60_000;

function error(status: number, code: CoachErrorCode, message: string, retryAfterSeconds?: number) {
  return Response.json({ error: code, message, retryAfterSeconds } satisfies CoachError, {
    status,
    headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
  });
}

/** Vercel sets x-real-ip and x-forwarded-for itself, so visitors can't choose their own. */
function visitorId(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export interface HandlerEnv {
  /** Null when no AI key is configured on the server. */
  provider: AiProvider | null;
  now?: () => Date;
  /** Rate limits; tests pass their own so they don't share counts. */
  guard?: CoachGuard;
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

  const guard = env.guard ?? sharedGuard;
  const admitted = guard.admit({ visitor: visitorId(request), mode: req.mode, provider, now: now.getTime() });
  if (!admitted.ok) return error(admitted.status, admitted.error, admitted.message, admitted.retryAfterSeconds);

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

  let result;
  try {
    result = await provider.call({
      system: COACH_SYSTEM_PROMPT,
      turns,
      search: req.mode === "ideas" ? "require" : "allow",
    });
  } finally {
    admitted.done();
  }
  if (!result.ok) {
    // The provider's own limit was hit: pause everyone instead of sending more doomed requests.
    if (result.error === "quota") guard.pause(result.retryAfterSeconds ?? 30, now.getTime());
    return error(result.status, result.error, result.message, result.retryAfterSeconds);
  }
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
