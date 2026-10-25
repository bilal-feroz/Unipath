import { creditThreshold, referencedCourses } from "./prereq";
import type { Curriculum } from "./types";

export type IssueCode =
  | "invalid-field"
  | "invalid-prerequisite"
  | "duplicate-course"
  | "duplicate-group"
  | "missing-prerequisite"
  | "missing-corequisite"
  | "circular-prerequisite"
  | "invalid-credits"
  | "group-total-mismatch"
  | "impossible-elective"
  | "total-mismatch"
  | "impossible-credit-threshold"
  | "invalid-semester";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: IssueCode;
  message: string;
  courseCode?: string;
  groupId?: string;
}

const MAX_COURSE_CREDITS = 12;

/** Checks a structured curriculum for data problems. Errors make a curriculum unusable. */
export function validateCurriculum(c: Curriculum): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (code: IssueCode, message: string, extra: Partial<ValidationIssue> = {}) =>
    issues.push({ severity: "error", code, message, ...extra });
  const warn = (code: IssueCode, message: string, extra: Partial<ValidationIssue> = {}) =>
    issues.push({ severity: "warning", code, message, ...extra });

  // Duplicate course codes and group ids.
  const seen = new Set<string>();
  for (const course of c.courses) {
    if (seen.has(course.code)) {
      error("duplicate-course", `Course ${course.code} appears more than once.`, { courseCode: course.code });
    }
    seen.add(course.code);
  }
  const groupIds = new Set<string>();
  for (const g of c.groups) {
    if (groupIds.has(g.id)) error("duplicate-group", `Requirement group "${g.id}" appears more than once.`, { groupId: g.id });
    groupIds.add(g.id);
  }

  const byCode = new Map(c.courses.map((course) => [course.code, course]));

  for (const course of c.courses) {
    if (!Number.isFinite(course.credits) || course.credits <= 0 || course.credits > MAX_COURSE_CREDITS) {
      error("invalid-credits", `${course.code} has an invalid credit value (${course.credits}).`, {
        courseCode: course.code,
      });
    }
    for (const ref of referencedCourses(course.prerequisite)) {
      if (!byCode.has(ref)) {
        error("missing-prerequisite", `${course.code} requires ${ref}, which is not in this plan.`, {
          courseCode: course.code,
        });
      }
    }
    for (const ref of course.corequisites) {
      if (!byCode.has(ref)) {
        error("missing-corequisite", `${course.code} must be taken with ${ref}, which is not in this plan.`, {
          courseCode: course.code,
        });
      }
    }
    const threshold = creditThreshold(course.prerequisite);
    if (threshold > c.totalCredits - course.credits) {
      error(
        "impossible-credit-threshold",
        `${course.code} needs ${threshold} completed credits, which is more than the degree allows before taking it.`,
        { courseCode: course.code },
      );
    }
    if (
      course.recommendedSemester !== null &&
      (course.recommendedSemester < 1 || course.recommendedSemester > c.plannedSemesters)
    ) {
      warn("invalid-semester", `${course.code} has a suggested semester outside 1–${c.plannedSemesters}.`, {
        courseCode: course.code,
      });
    }
  }

  // Requirement groups.
  let requiredTotal = 0;
  for (const g of c.groups) {
    const options = g.courses.map((code) => byCode.get(code)).filter((x) => x !== undefined);
    const optionCredits = options.reduce((sum, course) => sum + course.credits, 0);
    if (g.minCredits <= 0) {
      error("group-total-mismatch", `"${g.title}" must require more than 0 credits.`, { groupId: g.id });
    }
    if (g.rule === "all" && optionCredits !== g.minCredits) {
      error(
        "group-total-mismatch",
        `"${g.title}" lists ${optionCredits} credits of courses but says ${g.minCredits} are required.`,
        { groupId: g.id },
      );
    }
    if (g.rule === "choose" && optionCredits < g.minCredits) {
      error(
        "impossible-elective",
        `"${g.title}" needs ${g.minCredits} credits but its options only add up to ${optionCredits}.`,
        { groupId: g.id },
      );
    }
    requiredTotal += g.minCredits;
  }
  if (requiredTotal !== c.totalCredits) {
    error(
      "total-mismatch",
      `Requirement groups add up to ${requiredTotal} credits, but the degree total is ${c.totalCredits}.`,
    );
  }

  for (const cycle of findPrerequisiteCycles(c)) {
    error("circular-prerequisite", `Circular prerequisites: ${[...cycle, cycle[0]].join(" → ")}.`, {
      courseCode: cycle[0],
    });
  }

  return issues;
}

/**
 * Finds prerequisite cycles (each reported once) using depth-first search.
 * Corequisites are excluded: two courses that must be taken together (e.g. a lecture and its lab) are valid.
 */
export function findPrerequisiteCycles(c: Curriculum): string[][] {
  const edges = new Map<string, string[]>();
  for (const course of c.courses) {
    edges.set(course.code, referencedCourses(course.prerequisite));
  }
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const reported = new Set<string>();

  const visit = (code: string) => {
    state.set(code, "visiting");
    stack.push(code);
    for (const next of edges.get(code) ?? []) {
      if (!edges.has(next)) continue;
      const s = state.get(next);
      if (s === "visiting") {
        const cycle = stack.slice(stack.indexOf(next));
        const key = [...cycle].sort().join(",");
        if (!reported.has(key)) {
          reported.add(key);
          cycles.push(cycle);
        }
      } else if (!s) {
        visit(next);
      }
    }
    stack.pop();
    state.set(code, "done");
  };

  for (const code of edges.keys()) if (!state.has(code)) visit(code);
  return cycles;
}
