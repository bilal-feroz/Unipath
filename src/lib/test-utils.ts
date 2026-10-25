import { loadCurriculum } from "@/lib/curriculum/load";
import type { RawCourse, RawCurriculum, RawGroup } from "@/lib/curriculum/schema";
import { indexCurriculum } from "@/lib/engine/model";

/** Builds a small raw curriculum for tests. Totals are computed so it validates by default. */
export function rawCurriculum(groups: RawGroup[], overrides: Partial<RawCurriculum> = {}): RawCurriculum {
  const total = groups.reduce((sum, g) => sum + g.minCredits, 0);
  return {
    id: "test-curriculum",
    universityId: "test-u",
    college: "Test College",
    majorId: "test-major",
    majorName: "Test Major",
    shortName: "TM",
    degree: "Bachelor of Science",
    version: "Test",
    totalCredits: total,
    plannedSemesters: 8,
    verification: "illustrative",
    lastUpdated: "2026-01-01",
    sources: [],
    groups,
    ...overrides,
  };
}

export function requiredGroup(id: string, courses: RawCourse[]): RawGroup {
  return {
    id,
    title: id,
    category: "major",
    rule: "all",
    minCredits: courses.reduce((sum, c) => sum + c.credits, 0),
    courses,
  };
}

export function course(code: string, credits = 3, prereq?: string, extra: Partial<RawCourse> = {}): RawCourse {
  return { code, title: `Course ${code}`, credits, ...(prereq ? { prereq } : {}), ...extra };
}

/** Loads a raw curriculum and returns its index, failing loudly if it doesn't validate. */
export function indexOf(raw: RawCurriculum) {
  const result = loadCurriculum(raw);
  if (!result.ok || !result.curriculum) {
    throw new Error(`Test curriculum invalid: ${result.issues.map((i) => i.message).join("; ")}`);
  }
  return indexCurriculum(result.curriculum);
}
