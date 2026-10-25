import { referencedCourses } from "@/lib/curriculum/prereq";
import type { Course, Curriculum, RequirementGroup } from "@/lib/curriculum/types";

/** Fast lookups over a curriculum. Built once per curriculum and cached. */
export interface CurriculumIndex {
  curriculum: Curriculum;
  byCode: Map<string, Course>;
  groupById: Map<string, RequirementGroup>;
  /** code -> codes of courses whose prerequisite rule mentions it. */
  dependents: Map<string, string[]>;
  /** True when any rule lets a prerequisite be taken in the same semester. */
  hasConcurrentRules: boolean;
}

const cache = new WeakMap<Curriculum, CurriculumIndex>();

export function indexCurriculum(curriculum: Curriculum): CurriculumIndex {
  const cached = cache.get(curriculum);
  if (cached) return cached;

  const byCode = new Map(curriculum.courses.map((c) => [c.code, c]));
  const groupById = new Map(curriculum.groups.map((g) => [g.id, g]));
  const dependents = new Map<string, string[]>();
  for (const course of curriculum.courses) {
    for (const ref of referencedCourses(course.prerequisite)) {
      if (!byCode.has(ref)) continue;
      dependents.set(ref, [...(dependents.get(ref) ?? []), course.code]);
    }
  }
  const hasConcurrentRules = curriculum.courses.some((c) =>
    JSON.stringify(c.prerequisite ?? null).includes('"concurrent":true'),
  );

  const index: CurriculumIndex = { curriculum, byCode, groupById, dependents, hasConcurrentRules };
  cache.set(curriculum, index);
  return index;
}

/** Only codes that exist in the curriculum. Unknown codes are ignored by the engine. */
export function knownCodes(index: CurriculumIndex, codes: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const code of codes) if (index.byCode.has(code)) out.add(code);
  return out;
}

export function creditsOf(index: CurriculumIndex, codes: Iterable<string>): number {
  let total = 0;
  for (const code of codes) total += index.byCode.get(code)?.credits ?? 0;
  return total;
}

export function courseName(index: CurriculumIndex, code: string): string {
  return index.byCode.get(code)?.title ?? code;
}
