import { getUniversity } from "@/lib/curriculum/registry";
import type { Curriculum } from "@/lib/curriculum/types";
import type { ParsedCoachRequest } from "./schema";

export const COACH_SYSTEM_PROMPT = `You are UniPath Coach, a friendly mentor for university students. You suggest portfolio projects that build on the courses a student has completed or is taking now, and that match what the industry expects today.

Before answering, search the web to check current industry practice for the student's field: the tools, frameworks and working practices employers and practitioners use now (for example testing, CI/CD, version control, security, accessibility, cloud). Prefer recent, reputable sources, and search for the current year (given in the student's details), not an older one.

Rules:
- Build only on the courses listed. In "buildsOn", use course codes from the student's list. Never invent courses.
- Keep projects realistic for a student working alone or in a small team: a few weeks each, using free tools.
- Don't invent statistics, salaries, quotes or company names. If you're unsure about something, say so plainly.
- Don't give advice about prerequisites, registration or graduation requirements; UniPath's planner handles that.
- Write in clear, friendly English for a student.`;

export interface StudentContext {
  university: string;
  degree: string;
  completed: { code: string; title: string }[];
  inProgress: { code: string; title: string }[];
  interests: string | null;
  /** Every code the AI is allowed to reference. */
  allowedCodes: Set<string>;
  /** e.g. "October 2026", so searches look for current sources rather than the model's training year. */
  today: string;
}

/** Removes control characters and squashes whitespace in text typed by the student. */
export function cleanText(text: string | undefined, max: number): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || null;
}

/** Builds the student's context from course codes, ignoring any code that isn't in the curriculum. */
export function studentContext(curriculum: Curriculum, request: ParsedCoachRequest, now: Date = new Date()): StudentContext {
  const byCode = new Map(curriculum.courses.map((c) => [c.code, c]));
  const completedCodes = [...new Set(request.completed)].filter((c) => byCode.has(c));
  const done = new Set(completedCodes);
  const inProgressCodes = [...new Set(request.inProgress)].filter((c) => byCode.has(c) && !done.has(c));
  const toItem = (code: string) => ({ code, title: byCode.get(code)!.title });
  return {
    university: getUniversity(curriculum.universityId)?.name ?? curriculum.universityId,
    degree: `${curriculum.degree} in ${curriculum.majorName}`,
    completed: completedCodes.map(toItem),
    inProgress: inProgressCodes.map(toItem),
    interests: cleanText(request.interests, 300),
    allowedCodes: new Set([...completedCodes, ...inProgressCodes]),
    today: now.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

function describeStudent(ctx: StudentContext): string {
  const list = (items: { code: string; title: string }[]) =>
    items.length ? items.map((c) => `  - ${c.code} ${c.title}`).join("\n") : "  - (none yet)";
  return [
    `Today: ${ctx.today}`,
    "",
    "Student",
    `- University: ${ctx.university}`,
    `- Degree: ${ctx.degree}`,
    `- Completed courses (${ctx.completed.length}):`,
    list(ctx.completed),
    `- Taking this semester (${ctx.inProgress.length}):`,
    list(ctx.inProgress),
    `- Interests: ${ctx.interests ? `"${ctx.interests}"` : "not given"}`,
  ].join("\n");
}

export const IDEAS_JSON_SHAPE = `{"trends": string, "ideas": [{"title": string, "summary": string, "whyItFits": string, "buildsOn": [course code from the list], "skills": [string], "industryPractices": [string], "stack": [string], "difficulty": "beginner" | "intermediate" | "advanced", "timeEstimate": string, "firstSteps": [string]}]}`;

export function ideasPrompt(ctx: StudentContext): string {
  return `${describeStudent(ctx)}

Task: Suggest 4 portfolio project ideas, ordered from beginner to advanced, that each combine several of the courses above and reflect current industry practice in this field. For each idea, explain in "whyItFits" which courses it draws on (by name, not code), and list concrete current industry practices it lets the student show (in "industryPractices"). Give 3 to 5 short "firstSteps". Then, in "trends", summarise in 2 or 3 sentences what employers currently expect from graduates in this field.

Respond with ONLY a JSON object, with no markdown and no code fences, in exactly this shape:
${IDEAS_JSON_SHAPE}`;
}

export function askPrompt(ctx: StudentContext, question: string, ideaTitles: string[]): string {
  const ideas = ideaTitles.length ? ideaTitles.map((t) => `  - ${t}`).join("\n") : "  - (none yet)";
  return `${describeStudent(ctx)}
- Project ideas the student is looking at:
${ideas}

The student asks: "${question}"

Answer in plain text, under 220 words. Use short paragraphs, or lines starting with "- " for lists. No headings and no tables. Refer to courses by their names, not their codes. Search the web if the question is about current tools, jobs or industry practice.`;
}
