import { knownCodes, type CurriculumIndex } from "@/lib/engine/model";
import type { GradingScale } from "./scales";

export interface GpaResult {
  /** Cumulative GPA rounded to 2 decimals, or null when no graded credits exist yet. */
  cgpa: number | null;
  /** The official rating band for the CGPA, e.g. "Very Good". */
  rating: string | null;
  /** Credit hours with a grade that counts toward the GPA. */
  gradedCredits: number;
  qualityPoints: number;
  gradedCourses: number;
  /** Completed courses with no grade recorded yet. */
  ungraded: string[];
  /** Completed courses with a grade that doesn't count (Pass, Transfer). */
  notCounted: string[];
}

export function roundGpa(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ratingFor(gpa: number, scale: GradingScale): string {
  const rounded = roundGpa(gpa);
  return scale.ratings.find((r) => rounded >= r.min)?.label ?? scale.ratings.at(-1)!.label;
}

/**
 * CGPA as the university defines it: the sum of (grade points × credit hours) over all graded courses,
 * divided by the total graded credit hours.
 */
export function computeGpa(
  index: CurriculumIndex,
  completedInput: Iterable<string>,
  grades: Record<string, string>,
  scale: GradingScale,
): GpaResult {
  const completed = knownCodes(index, completedInput);
  const bySymbol = new Map(scale.passingGrades.map((g) => [g.symbol, g]));
  let gradedCredits = 0;
  let qualityPoints = 0;
  let gradedCourses = 0;
  const ungraded: string[] = [];
  const notCounted: string[] = [];

  for (const code of completed) {
    const credits = index.byCode.get(code)!.credits;
    const grade = bySymbol.get(grades[code] ?? "");
    if (!grade) {
      ungraded.push(code);
      continue;
    }
    if (grade.points === null) {
      notCounted.push(code);
      continue;
    }
    gradedCredits += credits;
    qualityPoints += grade.points * credits;
    gradedCourses += 1;
  }

  const cgpa = gradedCredits > 0 ? roundGpa(qualityPoints / gradedCredits) : null;
  return {
    cgpa,
    rating: cgpa === null ? null : ratingFor(cgpa, scale),
    gradedCredits,
    qualityPoints,
    gradedCourses,
    ungraded,
    notCounted,
  };
}
