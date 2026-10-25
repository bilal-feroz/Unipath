import { z } from "zod";
import { CREDIT_LIMITS } from "@/lib/engine/scheduler";

/** Everything UniPath saves in the browser. Bump STATE_VERSION and add a migration when this changes. */
export const STATE_VERSION = 1;
export const STORAGE_KEY = "unipath:state";
export const BACKUP_PREFIX = "unipath:backup:";
export const THEME_KEY = "unipath:theme";

const termSchema = z.object({
  season: z.enum(["spring", "summer", "fall"]),
  year: z.number().int().min(2000).max(2100),
});

export const progressSchema = z.object({
  completed: z.array(z.string()),
  /** The student's own next-semester plan (item ids). Null = follow the recommendation. */
  nextSemester: z.array(z.string()).nullable(),
  /** Elective group id -> chosen course codes, in order of preference. */
  electiveChoices: z.record(z.string(), z.array(z.string())),
  /** Courses the student is taking this semester. Planning assumes they'll be passed. */
  inProgress: z.array(z.string()).default([]),
  /** Course code -> letter grade (for completed courses), used for the GPA tracker. */
  grades: z.record(z.string(), z.string().max(4)).default({}),
  updatedAt: z.string(),
});

export const preferencesSchema = z.object({
  maxCredits: z.number().int().min(CREDIT_LIMITS.min).max(CREDIT_LIMITS.max),
  includeSummer: z.boolean(),
  summerMaxCredits: z.number().int().min(CREDIT_LIMITS.min).max(CREDIT_LIMITS.summerMax),
  startTerm: termSchema,
});

export const profileSchema = z.object({
  universityId: z.string().min(1),
  curriculumId: z.string().min(1),
  /**
   * Progress is stored per curriculum, so switching majors never mixes up completed courses.
   * Copying courses between majors only happens when the student explicitly asks.
   */
  progress: z.record(z.string(), progressSchema),
  preferences: preferencesSchema,
});

export const persistedStateSchema = z.object({
  version: z.literal(STATE_VERSION),
  activeProfile: z.enum(["personal", "demo"]),
  personal: profileSchema.nullable(),
  demo: profileSchema.nullable(),
});

export type CurriculumProgress = z.infer<typeof progressSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type PersistedState = z.infer<typeof persistedStateSchema>;
