import { isSatisfied, unmetParts, type PrereqContext } from "@/lib/curriculum/prereq";
import type { PrereqExpr } from "@/lib/curriculum/types";
import { creditsOf, knownCodes, type CurriculumIndex } from "./model";

/** "inprogress" = being taken this semester; planning assumes it will be passed. */
export type CourseStatus = "completed" | "inprogress" | "planned" | "eligible" | "locked";

export interface CourseState {
  code: string;
  status: CourseStatus;
  /** Prerequisites satisfied by completed courses (and courses being taken this semester). */
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

/**
 * Status of every course for planning next semester. Courses being taken this semester are assumed to be
 * passed, so the courses they unlock show as available.
 */
export function courseStates(
  index: CurriculumIndex,
  completedInput: Iterable<string>,
  plannedInput: Iterable<string> = [],
  inProgressInput: Iterable<string> = [],
): Map<string, CourseState> {
  const completed = knownCodes(index, completedInput);
  const inProgress = knownCodes(index, inProgressInput);
  for (const code of completed) inProgress.delete(code);
  const planned = knownCodes(index, plannedInput);
  const assumedDone = new Set([...completed, ...inProgress]);
  const ctx = prereqContext(index, assumedDone);

  const groupDone = new Map<string, boolean>();
  for (const group of index.curriculum.groups) {
    if (group.rule !== "choose") continue;
    const credits = creditsOf(
      index,
      group.courses.filter((c) => assumedDone.has(c)),
    );
    groupDone.set(group.id, credits >= group.minCredits);
  }

  const states = new Map<string, CourseState>();
  for (const course of index.curriculum.courses) {
    const prereqMet = isSatisfied(course.prerequisite, ctx);
    let status: CourseStatus;
    if (completed.has(course.code)) status = "completed";
    else if (inProgress.has(course.code)) status = "inprogress";
    else if (planned.has(course.code)) status = "planned";
    else if (prereqMet) status = "eligible";
    else status = "locked";
    states.set(course.code, {
      code: course.code,
      status,
      prereqMet,
      missing: unmetParts(course.prerequisite, ctx),
      coreqMissing: course.corequisites.filter((c) => !assumedDone.has(c) && !planned.has(c)),
      notNeeded: status !== "completed" && status !== "inprogress" && !!groupDone.get(course.groupId),
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
