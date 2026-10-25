import { courseName, knownCodes, type CurriculumIndex } from "./model";
import { unlockedBy } from "./status";
import { resolveTargets } from "./targets";

export interface CourseImpact {
  code: string;
  title: string;
  /** Courses that become available right after finishing this one. */
  unlocksNow: string[];
  /** Remaining required courses that depend on this one, directly or indirectly. */
  downstream: string[];
  /** Courses in the longest prerequisite chain that starts here (including this one). */
  chainLength: number;
  /** In a group where every course is required. */
  required: boolean;
}

function neededCodes(index: CurriculumIndex, completed: Set<string>, electiveChoices?: Record<string, string[]>) {
  return resolveTargets(index, completed, electiveChoices).courseCodes;
}

export function courseImpact(
  index: CurriculumIndex,
  completedInput: Iterable<string>,
  code: string,
  electiveChoices?: Record<string, string[]>,
  needed: Set<string> = neededCodes(index, knownCodes(index, completedInput), electiveChoices),
): CourseImpact {
  const completed = knownCodes(index, completedInput);
  const course = index.byCode.get(code);

  const downstream = new Set<string>();
  const stack = [code];
  while (stack.length) {
    for (const d of index.dependents.get(stack.pop()!) ?? []) {
      if (needed.has(d) && !downstream.has(d)) {
        downstream.add(d);
        stack.push(d);
      }
    }
  }

  const memo = new Map<string, number>();
  const chain = (c: string): number => {
    if (memo.has(c)) return memo.get(c)!;
    memo.set(c, 1);
    const deps = (index.dependents.get(c) ?? []).filter((d) => needed.has(d));
    const value = 1 + Math.max(0, ...deps.map(chain));
    memo.set(c, value);
    return value;
  };

  // A newly opened course is only worth mentioning if it's still needed: a required course,
  // or an option in an elective group that isn't complete yet.
  const stillRelevant = (c: string) => {
    if (needed.has(c)) return true;
    const group = index.groupById.get(index.byCode.get(c)!.groupId)!;
    if (group.rule !== "choose") return false;
    const earned = group.courses.filter((x) => completed.has(x)).reduce((s, x) => s + index.byCode.get(x)!.credits, 0);
    return earned < group.minCredits;
  };

  return {
    code,
    title: course?.title ?? code,
    unlocksNow: unlockedBy(index, completed, code).filter(stillRelevant),
    downstream: [...downstream],
    chainLength: chain(code),
    required: !!course && index.groupById.get(course.groupId)?.rule === "all",
  };
}

export interface Insight {
  code: string;
  title: string;
  message: string;
  unlocks: string[];
}

function listNames(index: CurriculumIndex, codes: string[], max = 3): string {
  const names = codes.slice(0, max).map((c) => courseName(index, c));
  const more = codes.length - names.length;
  if (more > 0) return `${names.join(", ")} and ${more} more`;
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * One actionable, verifiable insight about next semester: the planned course that opens the most doors.
 * Every statement is derived from the prerequisite graph; returns null if nothing meaningful can be said.
 */
export function nextStepInsight(
  index: CurriculumIndex,
  completedInput: Iterable<string>,
  nextSemesterCodes: string[],
  electiveChoices?: Record<string, string[]>,
): Insight | null {
  const completed = knownCodes(index, completedInput);
  const needed = neededCodes(index, completed, electiveChoices);
  const impacts = nextSemesterCodes
    .filter((c) => index.byCode.has(c) && !completed.has(c))
    .map((c) => courseImpact(index, completed, c, electiveChoices, needed))
    .sort((a, b) => b.unlocksNow.length - a.unlocksNow.length || b.chainLength - a.chainLength || a.code.localeCompare(b.code));

  const best = impacts[0];
  if (!best) return null;
  if (best.unlocksNow.length >= 2) {
    return {
      code: best.code,
      title: best.title,
      unlocks: best.unlocksNow,
      message: `Taking ${best.title} next semester unlocks ${best.unlocksNow.length} more courses: ${listNames(index, best.unlocksNow)}.`,
    };
  }
  if (best.unlocksNow.length === 1) {
    return {
      code: best.code,
      title: best.title,
      unlocks: best.unlocksNow,
      message: `Taking ${best.title} next semester unlocks ${listNames(index, best.unlocksNow)}.`,
    };
  }
  if (best.chainLength >= 3) {
    return {
      code: best.code,
      title: best.title,
      unlocks: [],
      message: `${best.title} starts a chain of ${best.chainLength} courses, so taking it early keeps you on track.`,
    };
  }
  return null;
}

/** Remaining courses that hold up the most later courses (a transparent heuristic, not a proof). */
export function keyCourses(
  index: CurriculumIndex,
  completedInput: Iterable<string>,
  electiveChoices?: Record<string, string[]>,
  limit = 5,
): CourseImpact[] {
  const completed = knownCodes(index, completedInput);
  const needed = neededCodes(index, completed, electiveChoices);
  return [...needed]
    .map((code) => courseImpact(index, completed, code, electiveChoices, needed))
    .filter((impact) => impact.chainLength >= 2)
    .sort(
      (a, b) =>
        b.chainLength - a.chainLength ||
        b.downstream.length - a.downstream.length ||
        (index.byCode.get(a.code)?.recommendedSemester ?? 99) - (index.byCode.get(b.code)?.recommendedSemester ?? 99) ||
        a.code.localeCompare(b.code),
    )
    .slice(0, limit);
}
