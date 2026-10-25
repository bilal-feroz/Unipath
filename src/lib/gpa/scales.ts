/**
 * University grading scales. Only scales transcribed from an official source are listed;
 * the GPA tracker is hidden for universities without one.
 */

export interface GradeOption {
  symbol: string;
  label: string;
  /** Points per credit hour; null = not counted in the GPA (e.g. Pass, Transfer). */
  points: number | null;
  /** Percentage band as printed by the university, if any. */
  range: string | null;
}

export interface GpaRating {
  /** Lowest GPA (inclusive, after rounding to 2 decimals) for this rating. */
  min: number;
  label: string;
}

export interface GradingScale {
  id: string;
  universityId: string;
  name: string;
  maxPoints: number;
  /** Grades a student can record for a course they have passed. */
  passingGrades: GradeOption[];
  /** Failing grades that count in the GPA (for earlier attempts of a course). */
  failingGrades: GradeOption[];
  /** Highest rating first. */
  ratings: GpaRating[];
  source: { title: string; url: string; retrieved: string };
  notes: string[];
}

export const AAU_UNDERGRADUATE: GradingScale = {
  id: "aau-undergraduate",
  universityId: "aau",
  name: "Al Ain University — Bachelor degrees",
  maxPoints: 4,
  passingGrades: [
    { symbol: "A", label: "A", points: 4.0, range: "90–100" },
    { symbol: "B+", label: "B+", points: 3.5, range: "85–89" },
    { symbol: "B", label: "B", points: 3.0, range: "80–84" },
    { symbol: "C+", label: "C+", points: 2.5, range: "75–79" },
    { symbol: "C", label: "C", points: 2.0, range: "70–74" },
    { symbol: "D+", label: "D+", points: 1.5, range: "65–69" },
    { symbol: "D", label: "D", points: 1.0, range: "60–64" },
    { symbol: "P", label: "P (Pass)", points: null, range: null },
    { symbol: "T", label: "T (Transfer)", points: null, range: null },
  ],
  failingGrades: [{ symbol: "F", label: "F", points: 0, range: "below 60" }],
  ratings: [
    { min: 3.6, label: "Excellent" },
    { min: 3.0, label: "Very Good" },
    { min: 2.5, label: "Good" },
    { min: 2.0, label: "Satisfactory" },
    { min: 0, label: "Unsatisfactory" },
  ],
  source: {
    title: "Al Ain University — Course Grading System",
    url: "https://www.aau.ac.ae/en/admission/undergraduate/course-grading-system",
    retrieved: "2026-10-25",
  },
  notes: [
    "The minimum passing grade is D. F (below 60) and FA (fail due to absence) are failing grades.",
    "P (Pass) and T (Transfer) carry no grade points, so UniPath leaves them out of the GPA.",
    "F counts as 0 points. FA (fail due to absence) has no points listed on the grading page, so UniPath doesn't offer it; if your transcript counts it, record it as F.",
    "The grading page doesn't say which attempt of a repeated course counts, so you choose the policy (all attempts, or only the latest).",
    "The grading guide doesn't say how CGPA is rounded. UniPath rounds to two decimals.",
  ],
};

const scales = [AAU_UNDERGRADUATE];

export function scaleForUniversity(universityId: string | null | undefined): GradingScale | null {
  return scales.find((s) => s.universityId === universityId) ?? null;
}
