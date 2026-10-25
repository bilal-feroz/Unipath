import { knownCodes, type CurriculumIndex } from "@/lib/engine/model";
import { ratingFor, roundGpa } from "./gpa";
import type { GradeOption, GradingScale } from "./scales";

/**
 * Semester GPA, repeated courses, forecasts and targets. Everything here is plain arithmetic on the
 * university's grade points: (grade points × credit hours) ÷ credit hours.
 */

export type RepeatPolicy = "all" | "latest";

/** An earlier attempt of a course (a fail, or a grade later replaced by a retake). */
export interface Attempt {
  id: string;
  code: string;
  grade: string;
  semester: number | null;
}

export interface GradeEntry {
  code: string;
  credits: number;
  grade: string;
  points: number;
  /** The student's own semester number (1 = first semester). */
  semester: number | null;
  source: "final" | "attempt" | "forecast";
  order: number;
}

export function gradeOption(scale: GradingScale, symbol: string): GradeOption | undefined {
  return [...scale.passingGrades, ...scale.failingGrades].find((g) => g.symbol === symbol);
}

/** Grades that carry points, best first (for pickers and forecasts). */
export function pointGrades(scale: GradingScale, includeFailing = false): GradeOption[] {
  return [...scale.passingGrades, ...(includeFailing ? scale.failingGrades : [])].filter((g) => g.points !== null);
}

export interface GradeInputs {
  index: CurriculumIndex;
  completed: Iterable<string>;
  grades: Record<string, string>;
  attempts: Attempt[];
  gradeTerms: Record<string, number>;
  scale: GradingScale;
}

/** Every graded attempt that carries points, before any repeat policy is applied. */
export function rawEntries(input: GradeInputs, forecast: Record<string, string> = {}, forecastSemester: number | null = null): GradeEntry[] {
  const { index, scale } = input;
  const out: GradeEntry[] = [];
  let order = 0;
  for (const a of input.attempts) {
    const course = index.byCode.get(a.code);
    const g = gradeOption(scale, a.grade);
    if (!course || !g || g.points === null) continue;
    out.push({ code: a.code, credits: course.credits, grade: a.grade, points: g.points, semester: a.semester, source: "attempt", order: order++ });
  }
  for (const code of knownCodes(index, input.completed)) {
    const g = gradeOption(scale, input.grades[code] ?? "");
    if (!g || g.points === null) continue;
    out.push({
      code,
      credits: index.byCode.get(code)!.credits,
      grade: g.symbol,
      points: g.points,
      semester: input.gradeTerms[code] ?? null,
      source: "final",
      order: order++,
    });
  }
  for (const [code, symbol] of Object.entries(forecast)) {
    const course = index.byCode.get(code);
    const g = gradeOption(scale, symbol);
    if (!course || !g || g.points === null) continue;
    out.push({ code, credits: course.credits, grade: symbol, points: g.points, semester: forecastSemester, source: "forecast", order: order++ });
  }
  return out;
}

const SOURCE_RANK = { attempt: 0, final: 1, forecast: 2 } as const;

/** "all": every attempt counts. "latest": only the most recent attempt of each course counts. */
export function applyPolicy(entries: GradeEntry[], policy: RepeatPolicy): GradeEntry[] {
  if (policy === "all") return entries;
  const latest = new Map<string, GradeEntry>();
  for (const e of entries) {
    const cur = latest.get(e.code);
    const newer =
      !cur ||
      SOURCE_RANK[e.source] > SOURCE_RANK[cur.source] ||
      (SOURCE_RANK[e.source] === SOURCE_RANK[cur.source] && ((e.semester ?? 0) > (cur.semester ?? 0) || ((e.semester ?? 0) === (cur.semester ?? 0) && e.order > cur.order)));
    if (newer) latest.set(e.code, e);
  }
  return [...latest.values()];
}

export interface GpaSummary {
  gpa: number | null;
  credits: number;
  points: number;
}

export function summarize(entries: GradeEntry[]): GpaSummary {
  const credits = entries.reduce((s, e) => s + e.credits, 0);
  const points = entries.reduce((s, e) => s + e.points * e.credits, 0);
  return { gpa: credits > 0 ? roundGpa(points / credits) : null, credits, points };
}

export interface SemesterGpa {
  semester: number;
  /** Semester GPA (SGPA) from the grades recorded in that semester. */
  sgpa: number | null;
  credits: number;
  /** CGPA at the end of that semester. */
  cgpaAfter: number | null;
}

/** SGPA for each semester the student has assigned grades to, and the CGPA after each one. */
export function semesterHistory(entries: GradeEntry[], policy: RepeatPolicy): { semesters: SemesterGpa[]; unassigned: number } {
  const numbers = [...new Set(entries.map((e) => e.semester).filter((s): s is number => s !== null))].sort((a, b) => a - b);
  const semesters = numbers.map((n) => {
    const own = summarize(entries.filter((e) => e.semester === n));
    const upTo = summarize(applyPolicy(entries.filter((e) => e.semester !== null && e.semester <= n), policy));
    return { semester: n, sgpa: own.gpa, credits: own.credits, cgpaAfter: upTo.gpa };
  });
  return { semesters, unassigned: entries.filter((e) => e.semester === null).length };
}

export interface ForecastResult {
  cgpa: number | null;
  /** GPA of the forecast courses on their own (this semester's predicted SGPA). */
  semesterGpa: number | null;
  rating: string | null;
  credits: number;
}

/** The CGPA if the current courses end with `forecast` grades. Courses without a grade are left out. */
export function forecastCgpa(input: GradeInputs, forecast: Record<string, string>, policy: RepeatPolicy): ForecastResult {
  const all = applyPolicy(rawEntries(input, forecast), policy);
  const total = summarize(all);
  const sem = summarize(all.filter((e) => e.source === "forecast"));
  return {
    cgpa: total.gpa,
    semesterGpa: sem.gpa,
    rating: total.gpa === null ? null : ratingFor(total.gpa, input.scale),
    credits: total.credits,
  };
}

export interface TargetResult {
  target: number;
  /** The average grade points needed across the current courses. */
  neededAverage: number;
  /** Already reached even with the lowest passing grade in every course. */
  alreadyMet: boolean;
  /** Possible this semester with grades on this scale. */
  achievable: boolean;
  /** The lowest single grade that, in every current course, reaches the target. */
  uniformGrade: GradeOption | null;
}

/**
 * What the current courses must average for the CGPA to reach `target` (as displayed, rounded to two
 * decimals). With the "latest" policy, a retaken course replaces its earlier attempt.
 */
export function requiredForTarget(
  input: GradeInputs,
  current: { code: string; credits: number }[],
  target: number,
  policy: RepeatPolicy,
): TargetResult | null {
  const credits = current.reduce((s, c) => s + c.credits, 0);
  if (credits === 0) return null;
  const codes = new Set(current.map((c) => c.code));
  let base = applyPolicy(rawEntries(input), policy);
  if (policy === "latest") base = base.filter((e) => !codes.has(e.code));
  const b = summarize(base);
  // A displayed CGPA of 3.80 means the unrounded value is at least 3.795.
  const rawTarget = target - 0.005;
  const neededAverage = (rawTarget * (b.credits + credits) - b.points) / credits;
  const grades = pointGrades(input.scale).sort((x, y) => x.points! - y.points!);
  const lowest = grades[0];
  const highest = grades.at(-1)!;
  const uniformGrade = grades.find((g) => g.points! >= neededAverage - 1e-9) ?? null;
  return {
    target,
    neededAverage: Math.max(0, neededAverage),
    alreadyMet: neededAverage <= lowest.points!,
    achievable: neededAverage <= highest.points! + 1e-9,
    uniformGrade,
  };
}

export interface CourseImpact {
  code: string;
  credits: number;
  best: number | null;
  worst: number | null;
  /** How far this one course can move the CGPA, between its best and worst grade. */
  swing: number;
}

/**
 * For each current course: the CGPA with its best grade and with its worst grade, keeping the other
 * courses at their expected grades. Bigger swing = this course matters more.
 */
export function courseImpact(
  input: GradeInputs,
  current: { code: string; credits: number }[],
  expected: Record<string, string>,
  policy: RepeatPolicy,
  bestGrade: string,
  worstGrade: string,
): CourseImpact[] {
  return current
    .map((c) => {
      const best = forecastCgpa(input, { ...expected, [c.code]: bestGrade }, policy).cgpa;
      const worst = forecastCgpa(input, { ...expected, [c.code]: worstGrade }, policy).cgpa;
      return { code: c.code, credits: c.credits, best, worst, swing: best !== null && worst !== null ? roundGpa(best - worst) : 0 };
    })
    .sort((a, b) => b.swing - a.swing);
}
