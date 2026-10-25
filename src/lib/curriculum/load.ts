import { parsePrereq, PrereqParseError } from "./prereq";
import { rawCurriculumSchema } from "./schema";
import type { Course, Curriculum, PrereqExpr } from "./types";
import { validateCurriculum, type ValidationIssue } from "./validate";

export interface LoadResult {
  /** Null when the data could not be read at all. */
  curriculum: Curriculum | null;
  issues: ValidationIssue[];
  /** True when there are no errors (warnings are allowed). */
  ok: boolean;
}

/** Reads a curriculum data file, converts it to the structured model, and validates it. */
export function loadCurriculum(raw: unknown): LoadResult {
  const parsed = rawCurriculumSchema.safeParse(raw);
  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
      severity: "error",
      code: "invalid-field",
      message: `${issue.path.join(".") || "curriculum"}: ${issue.message}`,
    }));
    return { curriculum: null, issues, ok: false };
  }

  const data = parsed.data;
  const issues: ValidationIssue[] = [];
  const courses: Course[] = [];

  for (const group of data.groups) {
    for (const rc of group.courses) {
      let prerequisite: PrereqExpr | null = null;
      try {
        prerequisite = parsePrereq(rc.prereq);
      } catch (err) {
        if (!(err instanceof PrereqParseError)) throw err;
        issues.push({
          severity: "error",
          code: "invalid-prerequisite",
          message: `${rc.code}: ${err.message}`,
          courseCode: rc.code,
        });
      }
      courses.push({
        code: rc.code,
        title: rc.title,
        credits: rc.credits,
        prerequisite,
        officialPrerequisiteText: rc.officialPrereq ?? null,
        corequisites: rc.coreqs ?? [],
        groupId: group.id,
        recommendedSemester: rc.semester ?? null,
        notes: rc.notes ?? [],
      });
    }
  }

  const curriculum: Curriculum = {
    id: data.id,
    universityId: data.universityId,
    college: data.college,
    majorId: data.majorId,
    majorName: data.majorName,
    shortName: data.shortName,
    degree: data.degree,
    version: data.version,
    totalCredits: data.totalCredits,
    plannedSemesters: data.plannedSemesters,
    verification: data.verification,
    lastUpdated: data.lastUpdated,
    sources: data.sources.map((s) => ({
      kind: s.kind,
      title: s.title,
      url: s.url ?? null,
      retrieved: s.retrieved ?? null,
    })),
    dataNotes: data.dataNotes ?? [],
    groups: data.groups.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      rule: g.rule,
      minCredits: g.minCredits,
      courses: g.courses.map((c) => c.code),
      slotSemesters: g.slotSemesters ?? [],
      description: g.description ?? "",
    })),
    courses,
  };

  issues.push(...validateCurriculum(curriculum));
  return { curriculum, issues, ok: !issues.some((i) => i.severity === "error") };
}
