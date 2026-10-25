import { z } from "zod";

/**
 * Shape of a curriculum data file. Data files keep the source document's structure
 * (requirement sections containing courses) so they are easy to check against the PDF.
 */

export const rawCourseSchema = z.object({
  code: z.string().min(1, "Course code is required"),
  title: z.string().min(1, "Course title is required"),
  credits: z.number({ error: "Credit hours must be a number" }),
  /** Prerequisite rule in UniPath's text format (see prereq.ts). */
  prereq: z.string().nullable().optional(),
  /** The prerequisite exactly as printed, when UniPath had to interpret it. */
  officialPrereq: z.string().optional(),
  coreqs: z.array(z.string()).optional(),
  semester: z.number().int().nullable().optional(),
  notes: z.array(z.string()).optional(),
});

export const rawGroupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(["university", "college", "major", "supporting", "internship", "capstone"]),
  rule: z.enum(["all", "choose"]),
  minCredits: z.number(),
  slotSemesters: z.array(z.number().int()).optional(),
  description: z.string().optional(),
  courses: z.array(rawCourseSchema),
});

export const rawCurriculumSchema = z.object({
  id: z.string().min(1),
  universityId: z.string().min(1),
  college: z.string().min(1),
  majorId: z.string().min(1),
  majorName: z.string().min(1),
  shortName: z.string().min(1),
  degree: z.string().min(1),
  version: z.string().min(1),
  totalCredits: z.number(),
  plannedSemesters: z.number().int().positive(),
  verification: z.enum(["official-transcribed", "illustrative"]),
  lastUpdated: z.string().min(1),
  sources: z.array(
    z.object({
      kind: z.enum(["study-plan", "guidance-plan"]),
      title: z.string().min(1),
      url: z.string().nullable().optional(),
      retrieved: z.string().nullable().optional(),
    }),
  ),
  dataNotes: z.array(z.string()).optional(),
  groups: z.array(rawGroupSchema).min(1, "A curriculum needs at least one requirement group"),
});

export type RawCourse = z.input<typeof rawCourseSchema>;
export type RawGroup = z.input<typeof rawGroupSchema>;
export type RawCurriculum = z.input<typeof rawCurriculumSchema>;
