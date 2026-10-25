import { z } from "zod";

/** What the browser sends. Only course codes are sent; the server looks up titles itself. */
export const coachRequestSchema = z.object({
  mode: z.enum(["ideas", "ask"]),
  curriculumId: z.string().min(1).max(100),
  completed: z.array(z.string().max(20)).max(150),
  inProgress: z.array(z.string().max(20)).max(30).default([]),
  interests: z.string().max(300).optional(),
  question: z.string().max(600).optional(),
  /** Titles of the ideas currently on screen, so follow-up questions have context. */
  ideaTitles: z.array(z.string().max(140)).max(8).optional(),
  history: z
    .array(z.object({ role: z.enum(["student", "coach"]), text: z.string().max(4000) }))
    .max(8)
    .optional(),
});

export type CoachRequest = z.input<typeof coachRequestSchema>;
export type ParsedCoachRequest = z.output<typeof coachRequestSchema>;

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface ProjectIdea {
  title: string;
  summary: string;
  whyItFits: string;
  /** Course codes from the student's own list (anything else is removed). */
  buildsOn: string[];
  skills: string[];
  industryPractices: string[];
  stack: string[];
  difficulty: Difficulty;
  timeEstimate: string;
  firstSteps: string[];
}

export interface CoachSource {
  title: string;
  url: string;
}

export interface IdeasResponse {
  mode: "ideas";
  trends: string;
  ideas: ProjectIdea[];
  sources: CoachSource[];
  searchQueries: string[];
  /** Whether a live web search was actually used for this answer. */
  searched: boolean;
  /** Provider name, e.g. "Groq". */
  provider: string;
  model: string;
  generatedAt: string;
}

export interface AskResponse {
  mode: "ask";
  answer: string;
  sources: CoachSource[];
  searchQueries: string[];
  searched: boolean;
  provider: string;
  model: string;
  generatedAt: string;
}

export type CoachResponse = IdeasResponse | AskResponse;

export type CoachErrorCode =
  | "not_configured"
  | "bad_request"
  | "rate_limited"
  | "busy"
  | "quota"
  | "declined"
  | "bad_output"
  | "upstream";

export interface CoachError {
  error: CoachErrorCode;
  message: string;
  /** When set, the coach can be tried again after this many seconds (also sent as Retry-After). */
  retryAfterSeconds?: number;
}
