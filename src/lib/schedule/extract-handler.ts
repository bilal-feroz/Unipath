import { z } from "zod";
import { sharedGuard, visitorId, type CoachGuard } from "@/lib/coach/guard";
import { extractJson } from "@/lib/coach/parse";
import type { AiProvider } from "@/lib/coach/provider";
import { getCurriculum } from "@/lib/curriculum/registry";
import type { ExtractedItem, ExtractedType, ExtractFlag } from "./extract";
import { TASK_TYPES } from "./schema";
import { isValidDate, TIME_RE } from "./time";

/**
 * POST /api/extract — finds academic dates in text the student pasted, using the configured AI provider.
 * The answer is checked against the text before it's returned, and nothing is saved here: the student
 * reviews every item first.
 */

const requestSchema = z.object({
  curriculumId: z.string().min(1).max(100),
  text: z.string().min(1).max(20_000),
  today: z.string().refine(isValidDate),
});

const TYPES = new Set<string>([...TASK_TYPES, "event"]);

const SYSTEM = `You read university course outlines, assignment sheets and announcements, and list every academic date in them.
Rules:
- Only list dates that are written in the text. Never invent dates, times, courses or locations.
- "type" is one of: ${[...TASK_TYPES, "event"].join(", ")}. Use "event" for workshops, seminars, fairs and similar.
- "date" is YYYY-MM-DD. If the text doesn't give the year, use the reference date to choose the next likely year and set "yearStated" to false.
- "time" is 24-hour HH:mm, or null if no time is written. For an exam or presentation, use its start time.
- "courseCode" must be one of the codes in the course list, or null.
- "source" is the exact sentence or line from the text that contains the date (at most 200 characters).
Reply with ONLY a JSON object, no markdown: {"items":[{"title": string, "type": string, "courseCode": string|null, "date": string, "time": string|null, "yearStated": boolean, "location": string, "source": string}]}`;

function error(status: number, code: string, message: string, retryAfterSeconds?: number) {
  return Response.json({ error: code, message, retryAfterSeconds }, {
    status,
    headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
  });
}

function normalise(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normaliseAiItems(raw: unknown, text: string, today: string, codes: Set<string>): ExtractedItem[] {
  const list = (raw as { items?: unknown })?.items;
  if (!Array.isArray(list)) return [];
  const haystack = normalise(text);
  const out: ExtractedItem[] = [];
  for (const [i, x] of list.slice(0, 60).entries()) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim().slice(0, 140) : "";
    const type = (typeof r.type === "string" && TYPES.has(r.type) ? r.type : "other") as ExtractedType;
    const date = typeof r.date === "string" && isValidDate(r.date) ? r.date : null;
    const time = typeof r.time === "string" && TIME_RE.test(r.time) ? r.time : null;
    const courseCode = typeof r.courseCode === "string" && codes.has(r.courseCode) ? r.courseCode : null;
    const source = typeof r.source === "string" ? r.source.trim().slice(0, 240) : "";
    const location = typeof r.location === "string" ? r.location.trim().slice(0, 120) : "";
    if (!title && !source) continue;
    const flags: ExtractFlag[] = [];
    if (!date) flags.push("no-date");
    if (r.yearStated === false) flags.push("no-year");
    if (!time) flags.push("no-time");
    if (!courseCode && !["registration", "payment", "admin", "event"].includes(type)) flags.push("no-course");
    if (type === "other") flags.push("unknown-type");
    if (date && date < today) flags.push("past-date");
    // A quote that isn't in the text means the answer can't be trusted as-is.
    const quoted = source.length > 0 && haystack.includes(normalise(source));
    const confidence: ExtractedItem["confidence"] =
      !quoted || !date || type === "other" ? "low" : flags.some((f) => f !== "no-time") ? "medium" : "high";
    out.push({ id: `ai-${i}`, title: title || source.slice(0, 80), type, courseCode, date, time, location, source: quoted ? source : "", confidence, flags });
  }
  return out;
}

export async function handleExtractRequest(
  request: Request,
  env: { provider: AiProvider | null; now?: () => Date; guard?: CoachGuard },
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "bad_request", "The request wasn't valid JSON.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return error(400, "bad_request", "The text is missing or too long (20,000 characters at most).");
  const curriculum = getCurriculum(parsed.data.curriculumId);
  if (!curriculum) return error(400, "bad_request", "That study plan isn't available.");
  if (!env.provider) return error(503, "not_configured", "The AI reader isn't set up on this server. Use the offline reader instead.");

  const guard = env.guard ?? sharedGuard;
  const now = (env.now?.() ?? new Date()).getTime();
  const admitted = guard.admit({ visitor: visitorId(request), mode: "extract", provider: env.provider, now });
  if (!admitted.ok) return error(admitted.status, admitted.error, admitted.message, admitted.retryAfterSeconds);

  const courses = curriculum.courses.map((c) => `${c.code} ${c.title}`).join("\n");
  let result;
  try {
    result = await env.provider.call({
      system: SYSTEM,
      turns: [{ role: "user", text: `Reference date: ${parsed.data.today}\n\nCourse list:\n${courses}\n\nText:\n"""\n${parsed.data.text}\n"""` }],
      search: "off",
    });
  } finally {
    admitted.done();
  }
  if (!result.ok) {
    if (result.error === "quota") guard.pause(result.retryAfterSeconds ?? 30, now);
    return error(result.status, result.error, result.message, result.retryAfterSeconds);
  }
  const items = normaliseAiItems(extractJson(result.text), parsed.data.text, parsed.data.today, new Set(curriculum.courses.map((c) => c.code)));
  return Response.json({ items, provider: env.provider.label, model: env.provider.model });
}
