import { isSatisfied, unmetParts, type PrereqContext } from "@/lib/curriculum/prereq";
import type { PrereqExpr } from "@/lib/curriculum/types";
import { creditsOf, knownCodes, type CurriculumIndex } from "./model";

export type CourseStatus = "completed" | "planned" | "eligible" | "locked";

export interface CourseState {
  code: string;
  status: CourseStatus;
  /** Prerequisites satisfied by completed courses. */
  prereqMet: boolean;
  /** The parts of the prerequisite rule that are still missing. */
  missing: PrereqExpr[];
  /** Corequisites that are neither completed nor planned alongside it. */
  coreqMissing: string[];
  /** An elective option whose requirement is already fully met by other courses. */
  notNeeded: boolean;
}

export function prereqContext(index: CurriculumIndex, completed: ReadonlySet<string>): PrereqContext {
  return { completed, earnedCredits: creditsOf(index, completed) };
}

/** Whether a course could be taken next semester given what is already completed. */
export function isEligible(index: CurriculumIndex, code: string, ctx: PrereqContext): boolean {
  const course = index.byCode.get(code);
  if (!course || ctx.completed.has(code)) return false;
  return isSatisfied(course.prerequisite, ctx);
}

export function courseStates(
  index: CurriculumIndex,
  completedInput: Iterable<string>,
  plannedInput: Iterable<string> = [],
): Map<string, CourseState> {
  const completed = knownCodes(index, completedInput);
  const planned = knownCodes(index, plannedInput);
  const ctx = prereqContext(index, completed);

  const groupDone = new Map<string, boolean>();
  for (const group of index.curriculum.groups) {
    if (group.rule !== "choose") continue;
    const credits = creditsOf(
      index,
      group.courses.filter((c) => completed.has(c)),
    );
    groupDone.set(group.id, credits >= group.minCredits);
  }

  const states = new Map<string, CourseState>();
  for (const course of index.curriculum.courses) {
    const prereqMet = isSatisfied(course.prerequisite, ctx);
    let status: CourseStatus;
    if (completed.has(course.code)) status = "completed";
    else if (planned.has(course.code)) status = "planned";
    else if (prereqMet) status = "eligible";
    else status = "locked";
    states.set(course.code, {
      code: course.code,
      status,
      prereqMet,
      missing: unmetParts(course.prerequisite, ctx),
      coreqMissing: course.corequisites.filter((c) => !completed.has(c) && !planned.has(c)),
      notNeeded: status !== "completed" && !!groupDone.get(course.groupId),
    });
  }
  return states;
}

/** Courses that would become available right after finishing `code` (given what is completed now). */
export function unlockedBy(index: CurriculumIndex, completedInput: Iterable<string>, code: string): string[] {
  const completed = knownCodes(index, completedInput);
  if (completed.has(code)) return [];
  const before = prereqContext(index, completed);
  const afterSet = new Set(completed).add(code);
  const after = prereqContext(index, afterSet);
  return index.curriculum.courses
    .filter(
      (c) =>
        c.code !== code &&
        !completed.has(c.code) &&
        !isSatisfied(c.prerequisite, before) &&
        isSatisfied(c.prerequisite, after),
    )
    .map((c) => c.code);
}
