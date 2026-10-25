import type { RequirementGroup } from "@/lib/curriculum/types";
import { creditsOf, knownCodes, type CurriculumIndex } from "./model";

export interface GroupProgress {
  group: RequirementGroup;
  requiredCredits: number;
  /** Completed credits that count toward this group (capped at the requirement). */
  countedCredits: number;
  completedCourses: string[];
  remainingCredits: number;
  done: boolean;
}

export interface DegreeProgress {
  totalCredits: number;
  /** Credits that count toward the degree (extra electives beyond a requirement don't). */
  countedCredits: number;
  /** All completed credit hours in this plan, used for "at least N credit hours" prerequisites. */
  earnedCredits: number;
  remainingCredits: number;
  /** 0–100 */
  percent: number;
  groups: GroupProgress[];
  complete: boolean;
  /** Saved course codes that are not part of this curriculum. */
  unknownCodes: string[];
}

export function evaluateProgress(index: CurriculumIndex, completedInput: Iterable<string>): DegreeProgress {
  const all = [...completedInput];
  const completed = knownCodes(index, all);
  const unknownCodes = [...new Set(all.filter((code) => !index.byCode.has(code)))];

  const groups: GroupProgress[] = index.curriculum.groups.map((group) => {
    const done = group.courses.filter((code) => completed.has(code));
    const credits = creditsOf(index, done);
    const counted = Math.min(credits, group.minCredits);
    return {
      group,
      requiredCredits: group.minCredits,
      countedCredits: counted,
      completedCourses: done,
      remainingCredits: group.minCredits - counted,
      done: counted >= group.minCredits,
    };
  });

  const countedCredits = groups.reduce((sum, g) => sum + g.countedCredits, 0);
  const totalCredits = index.curriculum.totalCredits;
  return {
    totalCredits,
    countedCredits,
    earnedCredits: creditsOf(index, completed),
    remainingCredits: Math.max(0, totalCredits - countedCredits),
    percent: totalCredits > 0 ? Math.round((countedCredits / totalCredits) * 100) : 0,
    groups,
    complete: groups.every((g) => g.done),
    unknownCodes,
  };
}
