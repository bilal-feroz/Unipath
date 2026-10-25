import { z } from "zod";
import type { CoachSource, Difficulty, ProjectIdea } from "./schema";

/** Pulls the first JSON object out of model text (tolerates code fences and stray prose). */
export function extractJson(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

const text = (max: number) =>
  z
    .unknown()
    .transform((v) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim().slice(0, max));

const list = (maxItems: number, maxLen: number) =>
  z
    .unknown()
    .transform((v) =>
      (Array.isArray(v) ? v : [])
        .map((item) => (typeof item === "string" ? item : item == null ? "" : String(item)).trim())
        .filter(Boolean)
        .slice(0, maxItems)
        .map((s) => s.slice(0, maxLen)),
    );

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

const ideaSchema = z.object({
  title: text(120),
  summary: text(700),
  whyItFits: text(700),
  buildsOn: list(16, 120),
  skills: list(10, 60),
  industryPractices: list(8, 220),
  stack: list(10, 60),
  difficulty: z.unknown().transform((v): Difficulty => {
    const d = String(v ?? "").toLowerCase();
    return DIFFICULTIES.find((x) => d.includes(x)) ?? "intermediate";
  }),
  timeEstimate: text(60),
  firstSteps: list(6, 260),
});

/** Course codes look like 0102221 or 0408101A; the model may add titles, so pick the codes out. */
function codesIn(value: string): string[] {
  return value.toUpperCase().match(/\b\d{6,8}[A-Z]?\b/g) ?? [];
}

/**
 * Turns the model's JSON into ideas UniPath can show. Ideas without a title are dropped, and
 * "buildsOn" keeps only course codes the student actually has.
 */
export function normalizeIdeas(
  raw: unknown,
  allowedCodes: ReadonlySet<string>,
): { trends: string; ideas: ProjectIdea[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const ideasRaw = Array.isArray(obj.ideas) ? obj.ideas : [];
  const ideas: ProjectIdea[] = [];
  for (const item of ideasRaw) {
    const parsed = ideaSchema.safeParse(item);
    if (!parsed.success || !parsed.data.title) continue;
    const codes = [...new Set(parsed.data.buildsOn.flatMap(codesIn))].filter((c) => allowedCodes.has(c));
    ideas.push({ ...parsed.data, buildsOn: codes });
    if (ideas.length === 6) break;
  }
  if (ideas.length === 0) return null;
  return { trends: text(1500).parse(obj.trends), ideas };
}

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

/** Web sources from Gemini's grounding metadata: http(s) links only, de-duplicated. */
export function sourcesFrom(chunks: GroundingChunk[] | undefined, max = 8): CoachSource[] {
  const seen = new Set<string>();
  const out: CoachSource[] = [];
  for (const chunk of chunks ?? []) {
    const url = chunk.web?.uri;
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    let title = (chunk.web?.title ?? "").trim();
    if (!title) {
      try {
        title = new URL(url).hostname;
      } catch {
        continue;
      }
    }
    out.push({ title: title.slice(0, 120), url });
    if (out.length === max) break;
  }
  return out;
}

/** Plain-text answers: trimmed and capped. React escapes the text when it's rendered. */
export function cleanAnswer(answer: string): string {
  return answer
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^#+\s*/gm, "")
    .trim()
    .slice(0, 4000);
}
